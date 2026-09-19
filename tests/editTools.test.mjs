#!/usr/bin/env node
// Script-level tests for folder handling in edit_item and batch_edit_items,
// plus add_folder's ambiguity message. Each OmniJS script is assembled the way
// src/utils/scriptExecution.ts does it (injected parameters + sharedUtils.js
// spliced in after the IIFE's opening) and run in a node:vm context with
// stand-in OmniFocus globals. They prove a folder error stops the edit before
// anything is written (PR #145 review).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', 'src', 'utils', 'omnifocusScripts');

// Mirrors scriptExecution.ts:132-158. Keep the injection text in step with it.
function assemble(scriptFile, args) {
  const script = readFileSync(join(SCRIPTS, scriptFile), 'utf8');
  const sharedUtils = readFileSync(join(SCRIPTS, 'lib', 'sharedUtils.js'), 'utf8');
  const injection = `
    // Injected parameters
    const injectedArgs = ${JSON.stringify(args)};
    const perspectiveName = injectedArgs.perspectiveName || null;
    const perspectiveId = injectedArgs.perspectiveId || null;
    const hideCompleted = injectedArgs.hideCompleted !== undefined ? injectedArgs.hideCompleted : true;
    const limit = injectedArgs.limit || 100;
    const includeBuiltIn = injectedArgs.includeBuiltIn !== undefined ? injectedArgs.includeBuiltIn : false;
    const includeSidebar = injectedArgs.includeSidebar !== undefined ? injectedArgs.includeSidebar : true;
    const format = injectedArgs.format || "detailed";
    `;
  return script.replace(
    '(() => {',
    `(() => {\n${injection}\n  // === Shared utilities ===\n${sharedUtils}\n  // === End shared utilities ===\n`
  );
}

const TASK_STATUS = {
  Available: 'Available', Blocked: 'Blocked', Completed: 'Completed',
  Dropped: 'Dropped', DueSoon: 'DueSoon', Next: 'Next', Overdue: 'Overdue',
};

// Stand-in for an OmniJS Folder: getFolderPath walks `.parent`; lookups and the
// error message read `.id.primaryKey`.
function folder(name, parent, id) {
  return { name, parent, id: { primaryKey: id } };
}

const clients = folder('Clients', null, 'f-clients');
const nestedArchive = folder('Archive', clients, 'f-nested');
const topArchive = folder('Archive', null, 'f-top');

// A fresh stand-in OmniFocus world per test. The Folder constructor and
// moveSections record what the script asked for.
function freshWorld() {
  const project = { id: { primaryKey: 'p1' }, name: 'Old name', parentFolder: null };
  const created = [];
  const moves = [];
  function Folder(name, parent) {
    this.name = name;
    this.parent = parent || null;
    this.id = { primaryKey: `new-${name}` };
    created.push(name);
  }
  // formatAmbiguousFolderError reads Folder.Status.Dropped for its dropped note
  Folder.Status = { Active: 'F-Active', Dropped: 'F-Dropped' };
  const globals = {
    flattenedFolders: [clients, nestedArchive, topArchive],
    flattenedProjects: [project],
    flattenedTasks: [],
    flattenedTags: [],
    Folder,
    Project: { byIdentifier: (id) => (id === 'p1' ? project : null), Status: {} },
    Task: { byIdentifier: () => null, Status: TASK_STATUS },
    Tag: function Tag() {},
    moveSections: (items, target) => moves.push(target),
    moveTasks: () => {},
    inbox: { ending: {} },
  };
  return { project, created, moves, globals };
}

function run(scriptFile, args, globals) {
  return JSON.parse(vm.runInNewContext(assemble(scriptFile, args), { ...globals }));
}

const AMBIGUOUS = 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: f-nested), "Archive" (id: f-top). Use the full "Parent > Child" path, or pass newFolderId.';

const EDIT_TOOLS = [
  { label: 'edit_item', script: 'editItem.js', wrap: (e) => e, unwrap: (r) => r },
  { label: 'batch_edit_items', script: 'batchEditItems.js', wrap: (e) => ({ edits: [e] }), unwrap: (r) => (r.results ? r.results[0] : r) },
];

for (const { label, script, wrap, unwrap } of EDIT_TOOLS) {
  const edit = (fields, globals) =>
    unwrap(run(script, wrap({ itemType: 'project', id: 'p1', newName: 'New name', ...fields }), globals));

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
}

test('add_folder: an ambiguous parentFolderName names parentFolderId', () => {
  const { created, globals } = freshWorld();
  const result = run('addFolder.js', { name: 'Child', parentFolderName: 'Archive' }, globals);
  assert.equal(result.success, false);
  assert.ok(result.error.endsWith('Use the full "Parent > Child" path, or pass parentFolderId.'));
  assert.deepEqual(created, []);
});
