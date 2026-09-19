#!/usr/bin/env node
// Script-level tests for folder handling in edit_item and batch_edit_items,
// plus add_folder's ambiguity message. Each script runs through the shared
// harness (tests/helpers/omnijsHarness.mjs) with stand-in OmniFocus globals.
// They pin the rule that a folder error stops the edit before any write.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript, folder, TASK_STATUS, FOLDER_STATUS } from './helpers/omnijsHarness.mjs';

// Shared across tests: no script under test changes a folder, so don't
// mutate them in a test.
const clients = folder('Clients', null, 'f-clients');
const nestedArchive = folder('Archive', clients, 'f-nested');
const topArchive = folder('Archive', null, 'f-top');

// A folder whose parent chain can't be read, as when an OmniJS proxy fails.
function unreadableChainFolder(name, id) {
  const f = folder(name, null, id);
  Object.defineProperty(f, 'parent', { get() { throw new Error('parent chain unreadable'); } });
  return f;
}

// A fresh stand-in OmniFocus world per test. The Folder constructor and
// moveSections record what the script asked for.
function freshWorld() {
  const project = { id: { primaryKey: 'p1' }, name: 'Old name', parentFolder: null };
  const second = { id: { primaryKey: 'p2' }, name: 'Second', parentFolder: null };
  const projects = [project, second];
  const created = [];
  const moves = [];
  function Folder(name, parent) {
    this.name = name;
    this.parent = parent || null;
    this.id = { primaryKey: `new-${name}` };
    created.push(name);
  }
  Folder.Status = FOLDER_STATUS;
  const globals = {
    flattenedFolders: [clients, nestedArchive, topArchive],
    flattenedProjects: projects,
    flattenedTasks: [],
    flattenedTags: [],
    Folder,
    Project: { byIdentifier: (id) => projects.find((p) => p.id.primaryKey === id) || null, Status: {} },
    Task: { byIdentifier: () => null, Status: TASK_STATUS },
    Tag: function Tag() {},
    moveSections: (items, target) => moves.push(target),
    moveTasks: () => {},
    inbox: { ending: {} },
  };
  return { project, second, created, moves, globals };
}

const AMBIGUOUS = 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: f-nested), "Archive" (id: f-top). Use the full "Parent > Child" path, or pass newFolderId.';

const EDIT_TOOLS = [
  { label: 'edit_item', script: 'editItem.js', wrap: (e) => e, unwrap: (r) => r },
  { label: 'batch_edit_items', script: 'batchEditItems.js', wrap: (e) => ({ edits: [e] }), unwrap: (r) => (r.results ? r.results[0] : r) },
];

for (const { label, script, wrap, unwrap } of EDIT_TOOLS) {
  const edit = (fields, globals) =>
    unwrap(runScript(script, wrap({ itemType: 'project', id: 'p1', newName: 'New name', ...fields }), globals));

  test(`${label}: ambiguous newFolderName fails before any write`, () => {
    const { project, created, moves, globals } = freshWorld();
    const result = edit({ newFolderName: 'Archive' }, globals);
    assert.equal(result.success, false);
    assert.equal(result.error, AMBIGUOUS);
    assert.equal(project.name, 'Old name');
    assert.deepEqual(created, []);
    assert.deepEqual(moves, []);
  });

  test(`${label}: unknown newFolderId fails before any write`, () => {
    const { project, created, moves, globals } = freshWorld();
    const result = edit({ newFolderId: 'nope' }, globals);
    assert.equal(result.success, false);
    assert.equal(result.error, 'Folder not found with ID "nope"');
    assert.equal(project.name, 'Old name');
    assert.deepEqual(created, []);
    assert.deepEqual(moves, []);
  });

  test(`${label}: a unique folder path still renames and moves`, () => {
    const { project, created, moves, globals } = freshWorld();
    const result = edit({ newFolderName: 'Clients > Archive' }, globals);
    assert.equal(result.success, true);
    assert.equal(project.name, 'New name');
    assert.deepEqual(moves, [nestedArchive]);
    assert.deepEqual(created, []);
  });

  test(`${label}: an unmatched newFolderName still creates the folder`, () => {
    const { project, created, globals } = freshWorld();
    const result = edit({ newFolderName: 'Brand New' }, globals);
    assert.equal(result.success, true);
    assert.equal(project.name, 'New name');
    assert.deepEqual(created, ['Brand New']);
  });

  test(`${label}: a valid newFolderId wins over an ambiguous newFolderName`, () => {
    const { project, created, moves, globals } = freshWorld();
    const result = edit({ newFolderId: 'f-top', newFolderName: 'Archive' }, globals);
    assert.equal(result.success, true);
    assert.equal(project.name, 'New name');
    assert.deepEqual(moves, [topArchive]);
    assert.deepEqual(created, []);
  });

  test(`${label}: an unknown newFolderId falls back to a newFolderName that resolves`, () => {
    const { project, created, moves, globals } = freshWorld();
    const result = edit({ newFolderId: 'nope', newFolderName: 'Clients > Archive' }, globals);
    assert.equal(result.success, true);
    assert.equal(project.name, 'New name');
    assert.deepEqual(moves, [nestedArchive]);
    assert.deepEqual(created, []);
  });

  test(`${label}: an unreadable parent chain fails the edit before any write`, () => {
    const { project, created, moves, globals } = freshWorld();
    globals.flattenedFolders = [clients, unreadableChainFolder('Archive', 'f-broken')];
    const result = edit({ newFolderName: 'Clients > Archive' }, globals);
    assert.equal(result.success, false);
    assert.match(result.error, /parent chain unreadable/);
    assert.equal(project.name, 'Old name');
    assert.deepEqual(created, []);
    assert.deepEqual(moves, []);
  });
}

test('batch_edit_items: an ambiguous edit fails alone and the next edit still applies', () => {
  const { project, second, created, moves, globals } = freshWorld();
  const result = runScript('batchEditItems.js', { edits: [
    { itemType: 'project', id: 'p1', newName: 'New name', newFolderName: 'Archive' },
    { itemType: 'project', id: 'p2', newName: 'Second renamed' },
  ] }, globals);
  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 1);
  assert.equal(result.results[0].error, AMBIGUOUS);
  assert.equal(result.results[1].success, true);
  assert.equal(project.name, 'Old name');
  assert.equal(second.name, 'Second renamed');
  assert.deepEqual(created, []);
  assert.deepEqual(moves, []);
});

test('add_folder: an ambiguous parentFolderName names parentFolderId', () => {
  const { created, globals } = freshWorld();
  const result = runScript('addFolder.js', { name: 'Child', parentFolderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.ok(result.error.endsWith('Use the full "Parent > Child" path, or pass parentFolderId.'));
  assert.deepEqual(created, []);
});
