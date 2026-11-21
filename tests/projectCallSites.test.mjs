#!/usr/bin/env node
// Script-level tests for the twelve project-name lookups that #149 puts
// behind resolveProjectRef, in ten OmniJS scripts. Each script runs through
// the shared harness (tests/helpers/omnijsHarness.mjs) with stand-in
// OmniFocus globals. They pin that, at every lookup:
// - among projects sharing a name, the single live one (Active or OnHold,
//   outside a dropped folder) is the one acted on;
// - with no single live one, the lookup fails closed with the one message,
//   naming that tool's ID parameter, and nothing is created, moved, edited,
//   removed or marked reviewed;
// - in a batch tool only that item fails, and the rest still apply.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, folder, TASK_STATUS, FOLDER_STATUS, PROJECT_STATUS } from './helpers/omnijsHarness.mjs';

const clashError = (idParam) =>
  'Project name "SMOKE-clash" is ambiguous - 2 projects match, and a name only resolves when exactly one is active or on hold outside a dropped folder: ' +
  '"SMOKE-clash" (id: p-clash1, Active), "SMOKE-clash" (id: p-clash2, Active). Pass ' + idParam + '.';

// A fresh stand-in OmniFocus world per test, since the edit tests rename
// projects. Projects named SMOKE-dup are Completed, Active, Completed, in
// that order, so first-match and last-match both pick a Completed copy.
// SMOKE-clash has two Active projects, so no single one is live. SMOKE-solo
// is unique. SMOKE-pair is an Active project and then a Dropped copy.
// SMOKE-twin is an Active project inside a dropped folder, then an Active
// one at the top level (#112). Every project holds one task named SMOKE-hit,
// for search_tasks.
function freshWorld() {
  const createdTasks = [];
  const createdProjects = [];
  const moved = [];
  const removed = [];
  const reviewed = [];

  const droppedFolder = folder('SMOKE-dropped', null, 'f-dropped', FOLDER_STATUS.Dropped);

  function project(id, name, status, parentFolder = null) {
    return {
      id: { primaryKey: id }, name, status, parentFolder,
      ending: { container: id },
      note: `note-${id}`,
      flattenedTasks: [], rootTask: null, sequential: false, flagged: false,
      dueDate: null, deferDate: null, estimatedMinutes: null,
      completedByChildren: false, containsSingletonActions: false,
      reviewInterval: null, nextReviewDate: null, lastReviewDate: null,
      markReviewed() { reviewed.push(id); },
    };
  }
  const projects = [
    project('p-done1', 'SMOKE-dup', PROJECT_STATUS.Done),
    project('p-live', 'SMOKE-dup', PROJECT_STATUS.Active),
    project('p-done2', 'SMOKE-dup', PROJECT_STATUS.Done),
    project('p-clash1', 'SMOKE-clash', PROJECT_STATUS.Active),
    project('p-clash2', 'SMOKE-clash', PROJECT_STATUS.Active),
    project('p-solo', 'SMOKE-solo', PROJECT_STATUS.Active),
    project('p-pair-live', 'SMOKE-pair', PROJECT_STATUS.Active),
    project('p-pair-dropped', 'SMOKE-pair', PROJECT_STATUS.Dropped),
    project('p-twin-dropped', 'SMOKE-twin', PROJECT_STATUS.Active, droppedFolder),
    project('p-twin-top', 'SMOKE-twin', PROJECT_STATUS.Active),
  ];

  const task = (id, name, containingProject) => ({
    id: { primaryKey: id }, name, containingProject, parent: null,
    taskStatus: TASK_STATUS.Available, note: '', tags: [], flagged: false,
    added: null, dueDate: null, deferDate: null,
  });
  const tasks = [
    task('t-move', 'SMOKE-move', null),
    task('t-move2', 'SMOKE-move2', null),
    ...projects.map((p) => task(`t-hit-${p.id.primaryKey}`, 'SMOKE-hit', p)),
  ];

  function Task(name, position) {
    this.name = name;
    this.id = { primaryKey: `new-${name}` };
    this.repetitionRule = null;
    const container = projects.find((p) => p.ending === position) || null;
    this.parent = container ? { project: container } : null;
    this.containingProject = container;
    this.addTag = () => {};
    createdTasks.push(position ? position.container : null);
  }
  Task.Status = TASK_STATUS;
  Task.byIdentifier = (id) => tasks.find((t) => t.id.primaryKey === id) || null;

  function Project(name, container) {
    this.name = name;
    this.parentFolder = container || null;
    this.id = { primaryKey: `new-${name}` };
    this.ending = { container: `new-${name}` };
    this.addTag = () => {};
    createdProjects.push(this);
  }
  Project.Status = PROJECT_STATUS;
  Project.byIdentifier = (id) => projects.find((p) => p.id.primaryKey === id) || null;

  function Folder() {
    throw new Error('no script under test should create a folder');
  }
  Folder.Status = FOLDER_STATUS;

  const globals = {
    flattenedProjects: projects,
    flattenedTasks: tasks,
    flattenedFolders: [droppedFolder],
    flattenedTags: [],
    Project,
    Task,
    Folder,
    Tag: function Tag() {},
    moveTasks: (moving, target) => {
      moved.push(target.id.primaryKey);
      for (const t of moving) t.containingProject = target;
    },
    moveSections: () => {},
    // A deleted project leaves flattenedProjects, as in OmniFocus, so a
    // name Map built after a delete doesn't see it.
    deleteObject: (item) => {
      removed.push(item.id.primaryKey);
      const at = projects.indexOf(item);
      if (at !== -1) projects.splice(at, 1);
    },
    inbox: { ending: { container: 'inbox' } },
  };
  const renamed = () => projects.filter((p) => p.name === 'SMOKE-renamed').map((p) => p.id.primaryKey);
  return {
    globals, projects, createdTasks, moved, removed, reviewed, renamed,
    copiedFrom: () => createdProjects.map((p) => (p.note || '').replace(/^note-/, '')),
  };
}

// The twelve lookups. Each `run` calls the script with `name` at that lookup.
// A batch site's `run` also sends a second, unambiguous item naming
// SMOKE-solo when `withSecond` is set. `error` is the lookup's error (in a
// batch tool, the first item's), and `acted` the project IDs the call acted on.
const SITES = [
  {
    label: 'add_omnifocus_task (addTask.js)', idParam: 'projectId',
    run: (w, name) => runScript('addTask.js', { name: 'SMOKE-new', projectName: name }, w.globals),
    error: (r) => r.error,
    acted: (w) => w.createdTasks,
  },
  {
    label: 'batch_add_items (batchAddItems.js)', idParam: 'projectId', batch: true,
    run: (w, name, withSecond) => runScript('batchAddItems.js', { items: [
      { type: 'task', name: 'SMOKE-new', projectName: name },
      ...(withSecond ? [{ type: 'task', name: 'SMOKE-ok', projectName: 'SMOKE-solo' }] : []),
    ] }, w.globals),
    error: (r) => r.results[0].error,
    acted: (w) => w.createdTasks,
  },
  {
    label: 'get_project_by_id (getProjectByName.js)', idParam: 'projectId',
    run: (w, name) => runScript('getProjectByName.js', { projectName: name }, w.globals),
    error: (r) => r.error,
    acted: (w, r) => (r.success ? [r.project.id] : []),
  },
  {
    label: 'search_tasks (searchTasks.js)', idParam: 'projectId',
    run: (w, name) => runScript('searchTasks.js', { query: 'SMOKE-hit', projectName: name }, w.globals),
    error: (r) => r.error,
    acted: (w, r) => (r.success ? r.tasks.map((t) => t.projectId) : []),
  },
  {
    label: 'duplicate_project (duplicateProject.js)', idParam: 'sourceProjectId',
    run: (w, name) => runScript('duplicateProject.js', { sourceProjectName: name, newName: 'SMOKE-copy' }, w.globals),
    error: (r) => r.error,
    acted: (w) => w.copiedFrom(),
  },
  {
    label: 'edit_item, finding a project (editItem.js)', idParam: 'id',
    run: (w, name) => runScript('editItem.js', { itemType: 'project', name, newName: 'SMOKE-renamed' }, w.globals),
    error: (r) => r.error,
    acted: (w) => w.renamed(),
  },
  {
    label: 'edit_item, newProjectName (editItem.js)', idParam: 'newProjectId',
    run: (w, name) => runScript('editItem.js', { itemType: 'task', id: 't-move', newProjectName: name }, w.globals),
    error: (r) => r.error,
    acted: (w) => w.moved,
  },
  {
    label: 'batch_edit_items, finding a project (batchEditItems.js)', idParam: 'id', batch: true,
    run: (w, name, withSecond) => runScript('batchEditItems.js', { edits: [
      { itemType: 'project', name, newName: 'SMOKE-renamed' },
      ...(withSecond ? [{ itemType: 'project', name: 'SMOKE-solo', newName: 'SMOKE-renamed' }] : []),
    ] }, w.globals),
    error: (r) => r.results[0].error,
    acted: (w) => w.renamed(),
  },
  {
    label: 'batch_edit_items, newProjectName (batchEditItems.js)', idParam: 'newProjectId', batch: true,
    run: (w, name, withSecond) => runScript('batchEditItems.js', { edits: [
      { itemType: 'task', id: 't-move', newProjectName: name },
      ...(withSecond ? [{ itemType: 'task', id: 't-move2', newProjectName: 'SMOKE-solo' }] : []),
    ] }, w.globals),
    error: (r) => r.results[0].error,
    acted: (w) => w.moved,
  },
  {
    label: 'batch_remove_items (batchRemoveItems.js)', idParam: 'id', batch: true,
    run: (w, name, withSecond) => runScript('batchRemoveItems.js', { items: [
      { itemType: 'project', name },
      ...(withSecond ? [{ itemType: 'project', name: 'SMOKE-solo' }] : []),
    ] }, w.globals),
    error: (r) => r.results[0].error,
    acted: (w) => w.removed,
  },
  {
    label: 'remove_item (removeTask.js)', idParam: 'id',
    run: (w, name) => runScript('removeTask.js', { itemType: 'project', name }, w.globals),
    error: (r) => r.error,
    acted: (w) => w.removed,
  },
  {
    label: 'batch_mark_reviewed (batchMarkReviewed.js)', idParam: 'projectIds', batch: true,
    run: (w, name, withSecond) => runScript('batchMarkReviewed.js', {
      projectNames: [name, ...(withSecond ? ['SMOKE-solo'] : [])],
    }, w.globals),
    error: (r) => r.results[0].error,
    acted: (w) => w.reviewed,
  },
];

for (const site of SITES) {
  test(`${site.label}: Completed, Active, Completed copies resolve to the Active one (#149)`, () => {
    const w = freshWorld();
    const result = site.run(w, 'SMOKE-dup', false);
    assert.deepEqual(site.acted(w, result), ['p-live']);
  });

  test(`${site.label}: two Active projects fail closed with the full message and act on nothing (#149)`, () => {
    const w = freshWorld();
    const result = site.run(w, 'SMOKE-clash', site.batch);
    assert.equal(site.error(result), clashError(site.idParam));
    if (site.batch) {
      // Only that item fails: the unambiguous second item still applies.
      assert.deepEqual(site.acted(w, result), ['p-solo']);
    } else {
      assert.equal(result.success, false);
      assert.deepEqual(site.acted(w, result), []);
    }
  });
}

test('add_omnifocus_task: an Active project inside a dropped folder loses to the top-level one (#149, #112)', () => {
  const w = freshWorld();
  runScript('addTask.js', { name: 'SMOKE-new', projectName: 'SMOKE-twin' }, w.globals);
  assert.deepEqual(w.createdTasks, ['p-twin-top']);
});

test('batch_remove_items: a second item naming the same project fails once the first removed it (#149)', () => {
  const w = freshWorld();
  const result = runScript('batchRemoveItems.js', { items: [
    { itemType: 'project', name: 'SMOKE-pair' },
    { itemType: 'project', name: 'SMOKE-pair' },
  ] }, w.globals);
  assert.deepEqual(w.removed, ['p-pair-live']);
  assert.equal(result.results[1].success, false);
  assert.equal(result.results[1].error, 'Item not found');
});

// From the review: the name Map is built lazily, so here it is built only
// after the first item has removed the Active copy by ID. The later name must
// still fail rather than reach the Dropped copy nobody named.
test('batch_remove_items: a name given after its project was removed by ID fails, though the name Map is built later (#149)', () => {
  const w = freshWorld();
  const result = runScript('batchRemoveItems.js', { items: [
    { itemType: 'project', id: 'p-pair-live' },
    { itemType: 'project', name: 'SMOKE-pair' },
  ] }, w.globals);
  assert.deepEqual(w.removed, ['p-pair-live']);
  assert.equal(result.results[1].success, false);
  assert.equal(result.results[1].error, 'Item not found');
});

test('remove_item: removing by a shared name reports the status and how many others matched (#149)', () => {
  const w = freshWorld();
  const result = runScript('removeTask.js', { itemType: 'project', name: 'SMOKE-dup' }, w.globals);
  assert.deepEqual(result, { success: true, id: 'p-live', name: 'SMOKE-dup', status: 'Active', otherMatches: 2 });
});

test('batch_remove_items: removing by a shared name reports the status and how many others matched (#149)', () => {
  const w = freshWorld();
  const result = runScript('batchRemoveItems.js', { items: [{ itemType: 'project', name: 'SMOKE-dup' }] }, w.globals);
  assert.deepEqual(result.results[0], { success: true, id: 'p-live', name: 'SMOKE-dup', status: 'Active', otherMatches: 2 });
});

// Today's shape, so these passed before the change too.
test('remove_item and batch_remove_items: removal by ID or by a unique name reports no status (#149)', () => {
  for (const args of [{ itemType: 'project', id: 'p-done1' }, { itemType: 'project', name: 'SMOKE-solo' }]) {
    const single = runScript('removeTask.js', args, freshWorld().globals);
    assert.deepEqual(Object.keys(single).sort(), ['id', 'name', 'success'], JSON.stringify(args));
    const batch = runScript('batchRemoveItems.js', { items: [args] }, freshWorld().globals);
    assert.deepEqual(Object.keys(batch.results[0]).sort(), ['id', 'name', 'success'], JSON.stringify(args));
  }
});

test('remove_item: a project name matches regardless of case (#149)', () => {
  const w = freshWorld();
  const result = runScript('removeTask.js', { itemType: 'project', name: 'smoke-SOLO' }, w.globals);
  assert.equal(result.success, true);
  assert.deepEqual(w.removed, ['p-solo']);
});
