#!/usr/bin/env node
// Script-level tests for the repetition rule each write path builds (#162).
// `repeatFrom: "due"`, or no repeatFrom, must build a fixed schedule based on
// the due date. The old DueDate method is stored by OmniFocus as "due again
// after completion", so a deadline drifted every time the task was completed.
// Runs the four write scripts through the shared harness
// (tests/helpers/omnijsHarness.mjs) with stand-in OmniFocus globals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runScript, addRepetitionGlobals, TASK_STATUS,
  REPETITION_METHOD, REPETITION_SCHEDULE_TYPE, ANCHOR_DATE_KEY,
} from './helpers/omnijsHarness.mjs';

const FIXED = ['FREQ=YEARLY', null, REPETITION_SCHEDULE_TYPE.Regularly, ANCHOR_DATE_KEY.DueDate, false];
const FROM_COMPLETION = ['FREQ=YEARLY', REPETITION_METHOD.DeferUntilDate];

// A stand-in world with one existing task, `t1`, for the edit scripts to find.
// `new Task` records each task it makes, for the add scripts.
function freshWorld() {
  const created = [];
  const existing = { id: { primaryKey: 't1' }, name: 'SMOKE-existing', repetitionRule: null };
  function Task(name) {
    this.name = name;
    this.id = { primaryKey: `new-${name}` };
    this.repetitionRule = null;
    this.parent = null;
    this.containingProject = null;
    created.push(this);
  }
  Task.Status = TASK_STATUS;
  Task.byIdentifier = (id) => (id === existing.id.primaryKey ? existing : null);
  addRepetitionGlobals(Task);
  const globals = {
    flattenedProjects: [],
    flattenedTasks: [existing],
    flattenedTags: [],
    flattenedFolders: [],
    Task,
    inbox: { ending: {} },
    moveTasks: () => {},
  };
  return { created, existing, globals };
}

// Each write path, reduced to one call: run the script with one repetition
// rule, and return the script's result for that task and the task itself.
const WRITE_PATHS = [
  {
    label: 'add_omnifocus_task (addTask.js)',
    run(rule, world) {
      const result = runScript('addTask.js', { name: 'SMOKE-add', repetitionRule: rule }, world.globals);
      return { result, task: world.created[0] };
    },
  },
  {
    label: 'batch_add_items (batchAddItems.js)',
    run(rule, world) {
      const reply = runScript('batchAddItems.js',
        { items: [{ type: 'task', name: 'SMOKE-add', repetitionRule: rule }] }, world.globals);
      return { result: reply.results[0], task: world.created[0] };
    },
  },
  {
    label: 'edit_item (editItem.js)',
    run(rule, world) {
      const result = runScript('editItem.js',
        { itemType: 'task', id: 't1', newRepetitionRule: rule }, world.globals);
      return { result, task: world.existing };
    },
  },
  {
    label: 'batch_edit_items (batchEditItems.js)',
    run(rule, world) {
      const reply = runScript('batchEditItems.js',
        { edits: [{ itemType: 'task', id: 't1', newRepetitionRule: rule }] }, world.globals);
      return { result: reply.results[0], task: world.existing };
    },
  },
];

for (const { label, run } of WRITE_PATHS) {
  test(`${label}: repeatFrom "due" builds a fixed schedule based on the due date`, () => {
    const { result, task } = run({ frequency: 'yearly', repeatFrom: 'due' }, freshWorld());
    assert.equal(result.success, true);
    assert.deepEqual(task.repetitionRule.args, FIXED);
  });

  test(`${label}: no repeatFrom builds a fixed schedule based on the due date`, () => {
    const { result, task } = run({ frequency: 'yearly' }, freshWorld());
    assert.equal(result.success, true);
    assert.deepEqual(task.repetitionRule.args, FIXED);
  });

  test(`${label}: repeatFrom "completion" still builds the DeferUntilDate method`, () => {
    const { result, task } = run({ frequency: 'yearly', repeatFrom: 'completion' }, freshWorld());
    assert.equal(result.success, true);
    assert.deepEqual(task.repetitionRule.args, FROM_COMPLETION);
  });
}

// What each script does when OmniFocus rejects the rule. #162 keeps this as it
// was: the add scripts still create the task and warn, edit_item fails, and
// batch_edit_items fails that edit alone and goes on to the next.
function rejectingWorld() {
  const world = freshWorld();
  world.globals.Task.RepetitionRule = function () { throw new Error('rule rejected'); };
  return world;
}

test('add_omnifocus_task: a rejected rule still creates the task, with a warning', () => {
  const world = rejectingWorld();
  const result = runScript('addTask.js', { name: 'SMOKE-add', repetitionRule: { frequency: 'yearly' } }, world.globals);
  assert.equal(result.success, true);
  assert.equal(result.warning, 'Could not set repetition rule: Error: rule rejected');
  assert.equal(world.created.length, 1);
  assert.equal(world.created[0].repetitionRule, null);
});

test('batch_add_items: a rejected rule still creates the task, with a warning', () => {
  const world = rejectingWorld();
  const reply = runScript('batchAddItems.js',
    { items: [{ type: 'task', name: 'SMOKE-add', repetitionRule: { frequency: 'yearly' } }] }, world.globals);
  assert.equal(reply.results[0].success, true);
  assert.equal(reply.results[0].warning, 'Could not set repetition rule: Error: rule rejected');
  assert.equal(world.created.length, 1);
  assert.equal(world.created[0].repetitionRule, null);
});

test('edit_item: a rejected rule fails the edit', () => {
  const world = rejectingWorld();
  const result = runScript('editItem.js',
    { itemType: 'task', id: 't1', newRepetitionRule: { frequency: 'yearly' } }, world.globals);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Failed to set repetition rule: Error: rule rejected');
  assert.equal(world.existing.repetitionRule, null);
});

test('batch_edit_items: a rejected rule fails that edit alone and the next edit still applies', () => {
  const world = rejectingWorld();
  const reply = runScript('batchEditItems.js', { edits: [
    { itemType: 'task', id: 't1', newRepetitionRule: { frequency: 'yearly' } },
    { itemType: 'task', id: 't1', newName: 'SMOKE-renamed' },
  ] }, world.globals);
  assert.equal(reply.results[0].success, false);
  assert.equal(reply.results[0].error, 'Failed to set repetition rule: Error: rule rejected');
  assert.equal(reply.results[1].success, true);
  assert.equal(world.existing.repetitionRule, null);
  assert.equal(world.existing.name, 'SMOKE-renamed');
});
