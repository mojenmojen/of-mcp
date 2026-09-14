#!/usr/bin/env node
// Unit tests for the pure folder-resolution helpers in
// src/utils/omnifocusScripts/lib/sharedUtils.js.
//
// sharedUtils.js is concatenated into OmniJS scripts and has no exports, so it
// cannot be imported. Instead it is read and evaluated with `new Function`,
// which mirrors the runtime's concatenation: a stubbed `Task` satisfies the
// load-time `Task.Status` dereference (see #133).

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

function loadSharedUtils() {
  const source = readFileSync(SHARED_UTILS, 'utf8');
  const factory = new Function(
    'Task',
    `${source}\nreturn { resolveFolderRef, formatAmbiguousFolderError, getFolderPath };`
  );
  return factory(TASK_STUB);
}

// Minimal stand-in for an OmniJS Folder: getFolderPath walks `.parent`, and
// formatAmbiguousFolderError reads `.id.primaryKey`. Pass `id` when two
// fixtures would otherwise get the same derived ID.
function folder(name, parent = null, id = null) {
  return { name, parent, id: { primaryKey: id || `${name}-${parent ? parent.name : 'root'}` } };
}

const { resolveFolderRef, formatAmbiguousFolderError } = loadSharedUtils();

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
