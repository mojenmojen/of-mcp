#!/usr/bin/env node
// Script-level tests for the five folder-name call sites outside the edit
// tools: add_project, duplicate_project, batch_add_items, list_projects and
// get_folder_by_id. Each script runs through the shared harness
// (tests/helpers/omnijsHarness.mjs) with stand-in OmniFocus globals. They pin
// that an ambiguous folder name fails closed at every site, with the exact
// message, and creates nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, folder, TASK_STATUS, FOLDER_STATUS, PROJECT_STATUS } from './helpers/omnijsHarness.mjs';

// Shared across tests: no script under test changes a folder, so don't
// mutate them in a test.
const clients = folder('Clients', null, 'f-clients');
const nestedArchive = folder('Archive', clients, 'f-nested');
const topArchive = folder('Archive', null, 'f-top');

const AMBIGUOUS = 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: f-nested), "Archive" (id: f-top). Use the full "Parent > Child" path, or pass folderId.';

// A fresh stand-in OmniFocus world per test. The Project and Task
// constructors record what the scripts create. No script here may create a
// folder, so the Folder constructor throws.
function freshWorld() {
  const createdProjects = [];
  const createdTasks = [];
  function Project(name, container) {
    this.name = name;
    this.parentFolder = container || null;
    this.id = { primaryKey: `new-${name}` };
    this.ending = {};
    this.addTag = () => {};
    createdProjects.push({ name, container: container || null });
  }
  Project.Status = PROJECT_STATUS;
  function Task(name) {
    this.name = name;
    this.id = { primaryKey: `new-${name}` };
    this.addTag = () => {};
    createdTasks.push(name);
  }
  Task.Status = TASK_STATUS;
  Task.byIdentifier = () => null;
  function Folder() {
    throw new Error('no script under test should create a folder');
  }
  Folder.Status = FOLDER_STATUS;
  const project = (id, name, parentFolder) => ({
    id: { primaryKey: id }, name, parentFolder, status: PROJECT_STATUS.Active,
    flattenedTasks: [], rootTask: null, note: '', sequential: false, nextReviewDate: null,
  });
  const globals = {
    flattenedFolders: [clients, nestedArchive, topArchive],
    flattenedProjects: [
      project('p-src', 'Template', null),
      project('p-nested', 'In nested', nestedArchive),
      project('p-top', 'In top', topArchive),
    ],
    flattenedTasks: [],
    flattenedTags: [],
    Folder,
    Project,
    Task,
    Tag: function Tag() {},
    moveSections: () => {},
    moveTasks: () => {},
    inbox: { ending: {} },
  };
  return { createdProjects, createdTasks, globals };
}

test('add_project: an ambiguous folderName creates no project', () => {
  const { createdProjects, globals } = freshWorld();
  const result = runScript('addProject.js', { name: 'New', folderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.equal(result.error, AMBIGUOUS);
  assert.deepEqual(createdProjects, []);
});

test('add_project: folderId wins over an ambiguous folderName', () => {
  const { createdProjects, globals } = freshWorld();
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-top', folderName: 'Archive' }, globals);
  assert.equal(result.success, true);
  assert.deepEqual(createdProjects, [{ name: 'New', container: topArchive }]);
});

test('add_project: a dropped twin is marked, so a caller can avoid it (#112)', () => {
  const { createdProjects, globals } = freshWorld();
  globals.flattenedFolders = [
    folder('Archive', null, 'f-live'),
    folder('Archive', null, 'f-dropped', FOLDER_STATUS.Dropped),
  ];
  const result = runScript('addProject.js', { name: 'New', folderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.equal(result.error, 'Folder name "Archive" is ambiguous - 2 folders match: "Archive" (id: f-live), "Archive" (id: f-dropped, dropped). Use the full "Parent > Child" path, or pass folderId.');
  assert.deepEqual(createdProjects, []);
});

test('duplicate_project: an ambiguous folderName creates no project', () => {
  const { createdProjects, globals } = freshWorld();
  const result = runScript('duplicateProject.js', { sourceProjectId: 'p-src', newName: 'Copy', folderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.equal(result.error, AMBIGUOUS);
  assert.deepEqual(createdProjects, []);
});

test('duplicate_project: a unique folder path places the copy in that folder', () => {
  const { createdProjects, globals } = freshWorld();
  const result = runScript('duplicateProject.js', { sourceProjectId: 'p-src', newName: 'Copy', folderName: 'Clients > Archive' }, globals);
  assert.equal(result.success, true);
  assert.deepEqual(createdProjects, [{ name: 'Copy', container: nestedArchive }]);
});

test('batch_add_items: an ambiguous project fails alone, its child task is not created, the rest still apply', () => {
  const { createdProjects, createdTasks, globals } = freshWorld();
  const result = runScript('batchAddItems.js', { items: [
    { type: 'project', name: 'Ambiguous', folderName: 'Archive', tempId: 'p1' },
    { type: 'task', name: 'Child', parentTempId: 'p1' },
    { type: 'project', name: 'Placed', folderName: 'Clients > Archive' },
  ] }, globals);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 2);
  assert.equal(result.results.find((r) => r.name === 'Ambiguous').error, AMBIGUOUS);
  assert.deepEqual(createdProjects, [{ name: 'Placed', container: nestedArchive }]);
  assert.deepEqual(createdTasks, []);
});

test('list_projects: an ambiguous folderName is an error, not a first-match listing', () => {
  const { globals } = freshWorld();
  const result = runScript('listProjects.js', { folderName: 'Archive', status: 'all' }, globals);
  assert.equal(result.success, false);
  assert.equal(result.error, AMBIGUOUS);
  assert.deepEqual(result.projects, []);
});

test('list_projects: folderId wins over an ambiguous folderName', () => {
  const { globals } = freshWorld();
  const result = runScript('listProjects.js', { folderId: 'f-top', folderName: 'Archive', status: 'all' }, globals);
  assert.equal(result.success, true);
  assert.deepEqual(result.projects.map((p) => p.name), ['In top']);
});

test('get_folder_by_id: an ambiguous folderName is an error', () => {
  const { globals } = freshWorld();
  const result = runScript('getFolderByName.js', { folderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.equal(result.error, AMBIGUOUS);
});
