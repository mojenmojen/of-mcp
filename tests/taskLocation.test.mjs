#!/usr/bin/env node
// Unit tests for describeTaskLocation (src/utils/taskLocation.ts), the
// wording add_omnifocus_task uses for where a new task landed (#157).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeTaskLocation } from '../dist/test-build/taskLocation.mjs';

test('a reported project is named with its ID, whichever argument found it', () => {
  const location = { type: 'project', name: 'Errands', id: 'p1' };
  assert.equal(describeTaskLocation(location, { projectId: 'p1' }), 'in project "Errands" (id: p1)');
  assert.equal(describeTaskLocation(location, { projectName: 'errands' }), 'in project "Errands" (id: p1)');
});

test('a reported parent task is named with its ID', () => {
  const location = { type: 'parentTask', name: 'Plan trip', id: 't1' };
  assert.equal(describeTaskLocation(location, { parentTaskId: 't1' }), 'as a subtask of "Plan trip" (id: t1)');
});

test('a reported inbox says inbox', () => {
  assert.equal(describeTaskLocation({ type: 'inbox' }, {}), 'in your inbox');
});

test('the reported location wins over the arguments', () => {
  assert.equal(
    describeTaskLocation({ type: 'project', name: 'Actual', id: 'p2' }, { projectName: 'Asked for' }),
    'in project "Actual" (id: p2)'
  );
});

test('with no reported location, projectId alone does not say inbox (#157)', () => {
  assert.equal(describeTaskLocation(undefined, { projectId: 'p1' }), 'in project with id p1');
});

test('with no reported location, the other argument cases are unchanged', () => {
  assert.equal(describeTaskLocation(undefined, { projectName: 'Errands' }), 'in project "Errands"');
  assert.equal(describeTaskLocation(undefined, { parentTaskName: 'Plan trip' }), 'as a subtask of "Plan trip"');
  assert.equal(describeTaskLocation(undefined, { parentTaskId: 't1' }), 'as a subtask of "t1"');
  assert.equal(describeTaskLocation(undefined, {}), 'in your inbox');
});
