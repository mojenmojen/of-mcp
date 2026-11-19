#!/usr/bin/env node
// Script-level tests for addProject.js: it reports where the new project
// landed, by full folder path, so add_project's reply names the real location
// (#151). Runs through the shared harness (tests/helpers/omnijsHarness.mjs)
// with stand-in OmniFocus globals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, folder, TASK_STATUS, PROJECT_STATUS } from './helpers/omnijsHarness.mjs';

const clients = folder('Clients', null, 'f-clients');
const archive = folder('Archive', clients, 'f-archive');

// `landIn` (a folder, or null for the root) makes `new Project` put every
// project there, whatever was asked for, so a test can tell the read-back
// apart from the request.
function freshWorld(folders = [clients, archive], { landIn } = {}) {
  function Project(name, container) {
    this.name = name;
    this.parentFolder = (landIn !== undefined ? landIn : container) || null;
    this.id = { primaryKey: `new-${name}` };
    this.addTag = () => {};
  }
  Project.Status = PROJECT_STATUS;
  function Task() {}
  Task.Status = TASK_STATUS;
  return { flattenedFolders: folders, flattenedTags: [], Project, Task };
}

test('folderId only: reports the folder by full path, not the root (#151)', () => {
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-archive' }, freshWorld());
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'folder', path: 'Clients > Archive', id: 'f-archive' });
});

test('folderName only: reports the matched folder by full path', () => {
  const result = runScript('addProject.js', { name: 'New', folderName: 'archive' }, freshWorld());
  assert.deepEqual(result.location, { type: 'folder', path: 'Clients > Archive', id: 'f-archive' });
});

test('no folder: reports the root', () => {
  const result = runScript('addProject.js', { name: 'New' }, freshWorld());
  assert.deepEqual(result.location, { type: 'root' });
});

test('an unreadable parent chain still succeeds, naming the folder alone', () => {
  const broken = { name: 'Orphan', id: { primaryKey: 'f-orphan' } };
  Object.defineProperty(broken, 'parent', { get() { throw new Error('parent unreadable'); } });
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-orphan' }, freshWorld([broken]));
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'folder', path: 'Orphan', id: 'f-orphan' });
});

test('read-back wins: a project that lands in a different folder is reported there', () => {
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-archive' }, freshWorld(undefined, { landIn: clients }));
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'folder', path: 'Clients', id: 'f-clients' });
});

test('a project that lands at the root although a folder was asked for is reported at the root', () => {
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-archive' }, freshWorld(undefined, { landIn: null }));
  assert.equal(result.success, true);
  assert.deepEqual(result.location, { type: 'root' });
});

test('an unreadable location still reports success, with no location (#154)', () => {
  // The project already exists by the time its folder is read, so a failure
  // here must not be reported: a caller told "failed" retries and duplicates it.
  const world = freshWorld();
  const RealProject = world.Project;
  world.Project = function (name, container) {
    const project = new RealProject(name, container);
    Object.defineProperty(project, 'parentFolder', {
      get() { throw new Error('parentFolder unreadable'); },
    });
    return project;
  };
  world.Project.Status = PROJECT_STATUS;
  const result = runScript('addProject.js', { name: 'New', folderId: 'f-archive' }, world);
  assert.equal(result.success, true);
  assert.equal(result.projectId, 'new-New');
  assert.equal(result.location, undefined);
});
