#!/usr/bin/env node
// Script-level tests for addTask.js: it reports where the new task landed,
// so add_omnifocus_task's reply names the real location (#157). Runs through
// the shared harness (tests/helpers/omnijsHarness.mjs) with stand-in
// OmniFocus globals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, TASK_STATUS } from './helpers/omnijsHarness.mjs';

// A stand-in world that places tasks as OmniFocus does. A task created at a
// project's `ending` sits under the project's root task, a parent whose
// `.project` is set. An inbox task has no parent. moveTasks re-parents a task
// and gives it its new parent's project. `landIn` ('inbox' or a project ID)
// makes `new Task` put every task there, whatever was asked for, so a test can
// tell the read-back apart from the request.
function freshWorld({ landIn } = {}) {
  const errands = { id: { primaryKey: 'p-errands' }, name: 'Errands', ending: { container: 'p-errands' } };
  const other = { id: { primaryKey: 'p-other' }, name: 'Other', ending: { container: 'p-other' } };
  const parent = { id: { primaryKey: 't-parent' }, name: 'Plan trip', parent: null, containingProject: null };
  const projectsById = { 'p-errands': errands, 'p-other': other };
  function Task(name, position) {
    this.name = name;
    this.id = { primaryKey: `new-${name}` };
    this.repetitionRule = null;
    const project = projectsById[landIn || position.container] || null;
    this.parent = project ? { project } : null;
    this.containingProject = project;
    this.addTag = () => {};
  }
  Task.Status = TASK_STATUS;
  const globals = {
    flattenedProjects: [errands, other],
    flattenedTasks: [parent],
    flattenedTags: [],
    Task,
    moveTasks: (tasks, target) => {
      for (const task of tasks) {
        task.parent = target;
        task.containingProject = target.containingProject || null;
      }
    },
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

test('read-back wins: a task that lands in a different project is reported there', () => {
  const result = runScript('addTask.js', { name: 'Buy milk', projectId: 'p-errands' }, freshWorld({ landIn: 'p-other' }));
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'project', name: 'Other', id: 'p-other' });
});

test('a task that lands in the inbox although a project was asked for is reported in the inbox', () => {
  const result = runScript('addTask.js', { name: 'Buy milk', projectId: 'p-errands' }, freshWorld({ landIn: 'inbox' }));
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'inbox' });
});

test('a subtask whose move did not happen is reported in the inbox, not under the parent', () => {
  const world = freshWorld();
  world.moveTasks = () => {};
  const result = runScript('addTask.js', { name: 'Book hotel', parentTaskId: 't-parent' }, world);
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'inbox' });
});

test('an unreadable location still reports success, with no location (#154)', () => {
  // The task already exists by the time its location is read, so a failure
  // here must not be reported: a caller told "failed" retries and duplicates it.
  const world = freshWorld();
  const RealTask = world.Task;
  world.Task = function (name, position) {
    const task = new RealTask(name, position);
    Object.defineProperty(task, 'containingProject', {
      get() { throw new Error('containingProject unreadable'); },
    });
    return task;
  };
  world.Task.Status = TASK_STATUS;
  const result = runScript('addTask.js', { name: 'Buy milk', projectId: 'p-errands' }, world);
  assert.equal(result.success, true);
  assert.equal(result.taskId, 'new-Buy milk');
  assert.equal(result.location, undefined);
});
