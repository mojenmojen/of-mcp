#!/usr/bin/env node
// Script-level tests for addTask.js: it reports where the new task landed,
// so add_omnifocus_task's reply names the real location (#157). Runs through
// the shared harness (tests/helpers/omnijsHarness.mjs) with stand-in
// OmniFocus globals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, TASK_STATUS } from './helpers/omnijsHarness.mjs';

function freshWorld() {
  const errands = { id: { primaryKey: 'p-errands' }, name: 'Errands', ending: { container: 'p-errands' } };
  const other = { id: { primaryKey: 'p-other' }, name: 'Other', ending: { container: 'p-other' } };
  const parent = { id: { primaryKey: 't-parent' }, name: 'Plan trip' };
  const projectsByEnding = { 'p-errands': errands, 'p-other': other };
  function Task(name, position) {
    this.name = name;
    this.id = { primaryKey: `new-${name}` };
    this.repetitionRule = null;
    this.containingProject = (position && projectsByEnding[position.container]) || null;
    this.addTag = () => {};
  }
  Task.Status = TASK_STATUS;
  const globals = {
    flattenedProjects: [errands, other],
    flattenedTasks: [parent],
    flattenedTags: [],
    Task,
    moveTasks: () => {},
    inbox: { ending: { container: 'inbox' } },
  };
  return globals;
}

test('projectId only: reports the project, not the inbox (#157)', () => {
  const result = runScript('addTask.js', { name: 'Buy milk', projectId: 'p-errands' }, freshWorld());
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'project', name: 'Errands', id: 'p-errands' });
});

test('projectName only: reports the matched project', () => {
  const result = runScript('addTask.js', { name: 'Buy milk', projectName: 'other' }, freshWorld());
  assert.deepEqual(result.location, { type: 'project', name: 'Other', id: 'p-other' });
});

test('no project or parent: reports the inbox', () => {
  const result = runScript('addTask.js', { name: 'Buy milk' }, freshWorld());
  assert.deepEqual(result.location, { type: 'inbox' });
});

test('parent task: reports the parent', () => {
  const result = runScript('addTask.js', { name: 'Book hotel', parentTaskId: 't-parent' }, freshWorld());
  assert.deepEqual(result.location, { type: 'parentTask', name: 'Plan trip', id: 't-parent' });
});
