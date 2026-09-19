#!/usr/bin/env node
// Unit tests for the pure folder-resolution helpers in
// src/utils/omnifocusScripts/lib/sharedUtils.js.
//
// sharedUtils.js is concatenated into OmniJS scripts and has no exports, so it
// cannot be imported. Instead it is read and evaluated with `new Function`,
// which mirrors the runtime's concatenation: a stubbed `Task` satisfies the
// load-time `Task.Status` dereference (see #133), and a stubbed `Folder`
// supplies the `Folder.Status` value the dropped-folder note compares against.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_UTILS = join(
  __dirname, '..', 'src', 'utils', 'omnifocusScripts', 'lib', 'sharedUtils.js'
);

const TASK_STUB = {
  Status: {
    Available: 'Available', Blocked: 'Blocked', Completed: 'Completed',
    Dropped: 'Dropped', DueSoon: 'DueSoon', Next: 'Next', Overdue: 'Overdue',
  },
};

const FOLDER_STUB = { Status: { Active: 'Active', Dropped: 'Dropped' } };

function loadSharedUtils() {
  const source = readFileSync(SHARED_UTILS, 'utf8');
  const factory = new Function(
    'Task', 'Folder',
    `${source}\nreturn { resolveFolderRef, formatAmbiguousFolderError, getFolderPath };`
  );
  return factory(TASK_STUB, FOLDER_STUB);
}

// Minimal stand-in for an OmniJS Folder: getFolderPath walks `.parent`,
// formatAmbiguousFolderError reads `.id.primaryKey`, and the dropped-folder
// note reads `.status`. Pass `id` when two fixtures would otherwise get the
// same derived ID.
function folder(name, parent = null, id = null, status = 'Active') {
  return { name, parent, id: { primaryKey: id || `${name}-${parent ? parent.name : 'root'}` }, status };
}

// A folder whose parent chain can't be read, as when an OmniJS proxy fails.
function unreadableChainFolder(name, id) {
  const f = folder(name, null, id);
  Object.defineProperty(f, 'parent', { get() { throw new Error('parent chain unreadable'); } });
  return f;
}

const { resolveFolderRef, formatAmbiguousFolderError, getFolderPath } = loadSharedUtils();

test('unique plain name resolves', () => {
  const archive = folder('Archive');
  const ref = resolveFolderRef('Archive', [folder('Clients'), archive]);
  assert.equal(ref.folder, archive);
  assert.equal(ref.ambiguous, false);
  assert.equal(ref.matches.length, 1);
});

test('plain name matching is case-insensitive', () => {
  const archive = folder('Archive');
  const ref = resolveFolderRef('aRcHiVe', [archive]);
  assert.equal(ref.folder, archive);
  assert.equal(ref.ambiguous, false);
});

test('duplicate plain name is ambiguous and resolves to nothing', () => {
  const clients = folder('Clients');
  const a = folder('Archive', clients);
  const b = folder('Archive');
  const ref = resolveFolderRef('Archive', [a, b]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.folder, null);
  assert.equal(ref.matches.length, 2);
});

test('no match is not ambiguous', () => {
  const ref = resolveFolderRef('Nope', [folder('Archive')]);
  assert.equal(ref.folder, null);
  assert.equal(ref.ambiguous, false);
  assert.equal(ref.matches.length, 0);
});

test('path syntax disambiguates a duplicated leaf name', () => {
  const clients = folder('Clients');
  const nested = folder('Archive', clients);
  const top = folder('Archive');
  const ref = resolveFolderRef('Clients > Archive', [top, nested]);
  assert.equal(ref.folder, nested);
  assert.equal(ref.ambiguous, false);
});

test('two identical full paths are ambiguous and keep distinct IDs', () => {
  const clients = folder('Clients');
  const a = folder('Archive', clients, 'a1');
  const b = folder('Archive', clients, 'a2');
  const ref = resolveFolderRef('Clients > Archive', [a, b]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.folder, null);
  assert.deepEqual(ref.matches.map((f) => f.id.primaryKey), ['a1', 'a2']);
  assert.equal(
    formatAmbiguousFolderError('Clients > Archive', ref.matches, 'folderId'),
    'Folder name "Clients > Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: a1), "Clients > Archive" (id: a2). Use the full "Parent > Child" path, or pass folderId.'
  );
});

test('error message lists every candidate by full path and folderId', () => {
  const clients = folder('Clients');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', clients), folder('Archive')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: Archive-Clients), "Archive" (id: Archive-root). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message names the calling tool\'s ID parameter', () => {
  const clients = folder('Clients');
  const matches = [folder('Archive', clients), folder('Archive')];
  for (const idParam of ['newFolderId', 'parentFolderId']) {
    assert.ok(
      formatAmbiguousFolderError('Archive', matches, idParam)
        .endsWith(`Use the full "Parent > Child" path, or pass ${idParam}.`),
      idParam
    );
  }
});

test('case-only duplicate names are ambiguous', () => {
  const ref = resolveFolderRef('ARCHIVE', [folder('Archive', null, 'x1'), folder('archive', null, 'x2')]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.matches.length, 2);
});

test('resolution table: several matches, mixed case, deeper chains', () => {
  const clients = folder('Clients');
  const work = folder('Work');
  const workClients = folder('Clients', work, 'wc');
  const top = folder('Archive', null, 'top');
  const nested = folder('Archive', clients, 'nested');
  const deep = folder('Archive', workClients, 'deep');
  const all = [clients, work, workClients, top, nested, deep];
  const cases = [
    // [input, expected folder (null = none), expected match count]
    ['Archive', null, 3],
    ['cLiEnTs > aRcHiVe', nested, 1],
    ['Work > Clients > Archive', deep, 1],
    // Full-chain rule: a path must match from the top level
    ['Clients > Archive', nested, 1],
    ['Work > Archive', null, 0],
  ];
  for (const [input, expected, count] of cases) {
    const ref = resolveFolderRef(input, all);
    assert.equal(ref.folder, expected, input);
    assert.equal(ref.matches.length, count, input);
    assert.equal(ref.ambiguous, count > 1, input);
  }
  assert.match(
    formatAmbiguousFolderError('Archive', resolveFolderRef('Archive', all).matches, 'folderId'),
    /- 3 folders match: /
  );
});

test('getFolderPath throws when the parent chain cannot be read', () => {
  assert.throws(() => getFolderPath(unreadableChainFolder('Archive', 'b1')), /parent chain unreadable/);
});

test('a path lookup throws rather than skip a candidate whose chain cannot be read', () => {
  const clients = folder('Clients');
  const nested = folder('Archive', clients, 'n1');
  assert.throws(
    () => resolveFolderRef('Clients > Archive', [clients, nested, unreadableChainFolder('Archive', 'b1')]),
    /parent chain unreadable/
  );
});

test('a plain-name lookup does not read parent chains', () => {
  const ref = resolveFolderRef('Archive', [unreadableChainFolder('Archive', 'b1'), folder('Archive', null, 'a2')]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.matches.length, 2);
});

test('error message shows a candidate with an unreadable chain by name and ID', () => {
  const message = formatAmbiguousFolderError(
    'Archive', [unreadableChainFolder('Archive', 'b1'), folder('Archive', null, 'a2')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Archive" (id: b1, full path unreadable), "Archive" (id: a2). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message marks a dropped candidate', () => {
  const clients = folder('Clients');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', clients, 'a1'), folder('Archive', null, 'a2', 'Dropped')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: a1), "Archive" (id: a2, dropped). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message marks a candidate inside a dropped folder', () => {
  const old = folder('Old', null, 'o1', 'Dropped');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', old, 'a3'), folder('Archive', null, 'a4')], 'folderId'
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Old > Archive" (id: a3, inside a dropped folder), "Archive" (id: a4). Use the full "Parent > Child" path, or pass folderId.');
});

test('error message leaves out the dropped note when a status cannot be read', () => {
  const unreadableStatus = folder('Archive', null, 'a5');
  Object.defineProperty(unreadableStatus, 'status', { get() { throw new Error('status unreadable'); } });
  const message = formatAmbiguousFolderError('Archive', [unreadableStatus, folder('Archive', null, 'a6')], 'folderId');
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Archive" (id: a5), "Archive" (id: a6). Use the full "Parent > Child" path, or pass folderId.');
});
