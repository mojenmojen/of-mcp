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

// Minimal stand-in for an OmniJS Folder: getFolderPath only walks `.parent`.
function folder(name, parent = null) {
  return { name, parent, id: { primaryKey: `${name}-${parent ? parent.name : 'root'}` } };
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

test('two identical full paths are ambiguous', () => {
  const clients = folder('Clients');
  const a = folder('Archive', clients);
  const b = folder('Archive', clients);
  const ref = resolveFolderRef('Clients > Archive', [a, b]);
  assert.equal(ref.ambiguous, true);
  assert.equal(ref.folder, null);
  assert.equal(ref.matches.length, 2);
});

test('error message lists every candidate by full path and folderId', () => {
  const clients = folder('Clients');
  const message = formatAmbiguousFolderError(
    'Archive', [folder('Archive', clients), folder('Archive')]
  );
  assert.equal(message, 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: Archive-Clients), "Archive" (id: Archive-root). Use the full "Parent > Child" path, or pass folderId.');
});
