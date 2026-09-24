#!/usr/bin/env node
// Unit tests for the retry policy (issue #154).
//
// Killing the osascript subprocess after 30s does not cancel the OmniJS script
// already running inside OmniFocus, so retrying a timed-out write lands it
// again. One add_folder call produced four folders: 1 attempt + MAX_RETRIES.
// These tests pin that a timeout is only ever retried for a script that is safe
// to repeat, and that every other retry stays as it was.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  RETRY_SAFE_SCRIPTS,
  MAX_RETRIES,
  isRetrySafeScript,
  shouldRetry
} from '../dist/test-build/retryPolicy.mjs';
import {
  createTimeoutError,
  createAppUnavailableError,
  createScriptError
} from '../dist/test-build/errors.mjs';

const WRITE_SCRIPT = '@addFolder.js';
const READ_SCRIPT = '@listProjects.js';

// The write side is listed here rather than in the source: the source only needs
// to know what is safe to repeat, and these tests need to prove the two lists
// together account for every script file.
const WRITE_SCRIPTS = new Set([
  'addFolder.js',
  'addProject.js',
  'addTask.js',
  'batchAddItems.js',
  'batchEditItems.js',
  'batchMarkReviewed.js',
  'batchRemoveItems.js',
  'duplicateProject.js',
  'editItem.js',
  'editTag.js',
  'removeTask.js',
  // Reads, but toggles document.focus, so a run killed mid-flight leaves Focus
  // cleared and a retry would restore the wrong state.
  'getCustomPerspectiveTasks.js'
]);

test('a timed-out write is not retried', () => {
  assert.equal(shouldRetry(createTimeoutError(), 0, WRITE_SCRIPT), false);
});

test('a timed-out read is still retried, up to MAX_RETRIES', () => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    assert.equal(shouldRetry(createTimeoutError(), attempt, READ_SCRIPT), true);
  }
  assert.equal(shouldRetry(createTimeoutError(), MAX_RETRIES, READ_SCRIPT), false);
});

test('a write is still retried when OmniFocus is not running', () => {
  // The script never ran, so repeating it cannot duplicate anything.
  assert.equal(shouldRetry(createAppUnavailableError(), 0, WRITE_SCRIPT), true);
});

test('a non-retryable error is never retried', () => {
  assert.equal(shouldRetry(createScriptError('boom'), 0, READ_SCRIPT), false);
  assert.equal(shouldRetry(createScriptError('boom'), 0, WRITE_SCRIPT), false);
});

test('the attempt cap still applies to every retryable error', () => {
  assert.equal(shouldRetry(createAppUnavailableError(), MAX_RETRIES, READ_SCRIPT), false);
});

test('a script is recognised however it is named', () => {
  assert.equal(isRetrySafeScript('@listProjects.js'), true);
  assert.equal(isRetrySafeScript('listProjects.js'), true);
  assert.equal(isRetrySafeScript('/tmp/somewhere/listProjects.js'), true);
  assert.equal(isRetrySafeScript('@addFolder.js'), false);
  assert.equal(isRetrySafeScript('/tmp/somewhere/addFolder.js'), false);
});

test('an unknown script is treated as unsafe to repeat', () => {
  // The harmless direction to fail: a new script loses timeout retries until
  // someone classifies it, rather than silently duplicating writes.
  assert.equal(isRetrySafeScript('@somethingBrandNew.js'), false);
  assert.equal(shouldRetry(createTimeoutError(), 0, '@somethingBrandNew.js'), false);
});

test('every OmniJS script on disk is classified, and every entry has a file', () => {
  const scriptsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', 'src', 'utils', 'omnifocusScripts'
  );
  const onDisk = readdirSync(scriptsDir).filter(name => name.endsWith('.js'));

  // Nothing unclassified: a new script must be a deliberate decision.
  const unclassified = onDisk.filter(
    name => !RETRY_SAFE_SCRIPTS.has(name) && !WRITE_SCRIPTS.has(name)
  );
  assert.deepEqual(unclassified, [], 'unclassified OmniJS scripts');

  // No phantom entries left behind by a rename or deletion.
  const classified = [...RETRY_SAFE_SCRIPTS, ...WRITE_SCRIPTS];
  const missing = classified.filter(name => !onDisk.includes(name));
  assert.deepEqual(missing, [], 'classified names with no script file');
});

test('every known write script is unsafe to repeat', () => {
  for (const name of WRITE_SCRIPTS) {
    assert.equal(isRetrySafeScript(name), false, `${name} must not be retried on timeout`);
    assert.equal(shouldRetry(createTimeoutError(), 0, name), false, name);
  }
});
