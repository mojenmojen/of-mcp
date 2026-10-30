#!/usr/bin/env node
// Unit tests for describeProjectLocation (src/utils/projectLocation.ts), the
// wording add_project uses for where a new project landed (#151).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeProjectLocation } from '../dist/test-build/projectLocation.mjs';

test('a reported folder is named by full path and ID, whichever argument found it', () => {
  const location = { type: 'folder', path: 'Clients > Archive', id: 'f1' };
  assert.equal(describeProjectLocation(location, { folderId: 'f1' }), 'in folder "Clients > Archive" (id: f1)');
  assert.equal(describeProjectLocation(location, { folderName: 'archive' }), 'in folder "Clients > Archive" (id: f1)');
});

test('a reported root says root level', () => {
  assert.equal(describeProjectLocation({ type: 'root' }, {}), 'at the root level');
});

test('the reported location wins over the arguments', () => {
  assert.equal(
    describeProjectLocation({ type: 'folder', path: 'Actual', id: 'f2' }, { folderName: 'Asked for' }),
    'in folder "Actual" (id: f2)'
  );
});

test('with no reported location, folderId alone does not say root level (#151)', () => {
  assert.equal(describeProjectLocation(undefined, { folderId: 'f1' }), 'in folder with id f1');
});

test('with no reported location, the other argument cases are unchanged', () => {
  assert.equal(describeProjectLocation(undefined, { folderName: 'Archive' }), 'in folder "Archive"');
  assert.equal(describeProjectLocation(undefined, {}), 'at the root level');
});
