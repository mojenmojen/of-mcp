#!/usr/bin/env node
// Unit tests for the retry policy (issue #154).
//
// Killing the osascript subprocess after 30s does not cancel the OmniJS script
// already running inside OmniFocus, so retrying a timed-out write lands it
// again. One add_folder call produced four folders: 1 attempt + MAX_RETRIES.
//
// Two questions are kept apart here, because collapsing them told a read tool
// it might have created a duplicate: may this script be repeated, and could it
// have written anything?

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  READ_SCRIPTS,
  WRITE_SCRIPTS,
  RETRY_SAFE_SCRIPTS,
  MAX_RETRIES,
  isRetrySafeScript,
  mayHaveWritten,
  shouldRetry,
  finalizeTimeoutError
} from '../dist/test-build/retryPolicy.mjs';
import {
  createTimeoutError,
  createAppUnavailableError,
  createScriptError,
  ErrorCodes
} from '../dist/test-build/errors.mjs';

const WRITE_SCRIPT = '@addFolder.js';
const READ_SCRIPT = '@listProjects.js';

const SCRIPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'utils', 'omnifocusScripts'
);

// ---------------------------------------------------------------- retrying

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

test('every write script is unsafe to repeat', () => {
  for (const name of WRITE_SCRIPTS) {
    assert.equal(isRetrySafeScript(name), false, `${name} must not be retried on timeout`);
    assert.equal(shouldRetry(createTimeoutError(), 0, name), false, name);
  }
});

test('the diagnostic is not retried when OmniFocus is wedged', () => {
  // diagnose_connection exists to explain an unresponsive OmniFocus. Running
  // the full ladder takes about 127s, past the two minutes a client waits, so
  // the answer arrives after the caller has given up.
  assert.equal(isRetrySafeScript('@diagnoseConnection.js'), false);
  assert.equal(shouldRetry(createTimeoutError(), 0, '@diagnoseConnection.js'), false);
});

test('a read that cannot be repeated is still not retried', () => {
  // getCustomPerspectiveTasks toggles document.focus, so a run killed
  // mid-flight would leave a retry restoring the wrong state.
  assert.equal(isRetrySafeScript('@getCustomPerspectiveTasks.js'), false);
});

// ------------------------------------------------------- writing vs reading

test('only a script that writes is treated as possibly having written', () => {
  assert.equal(mayHaveWritten('@addFolder.js'), true);
  assert.equal(mayHaveWritten('@listProjects.js'), false);
});

test('a read is not called a write just because it cannot be repeated', () => {
  // The bug this split exists to prevent: both of these are reads, so neither
  // may be described to the user as a change that might have landed.
  assert.equal(mayHaveWritten('@getCustomPerspectiveTasks.js'), false);
  assert.equal(mayHaveWritten('@diagnoseConnection.js'), false);
});

test('an unknown script is assumed to have written', () => {
  // Shows the warning rather than withholding it.
  assert.equal(mayHaveWritten('@somethingBrandNew.js'), true);
});

// ------------------------------------------------------ the reported error

test('a timed-out write is reported as possibly applied', () => {
  const finalized = finalizeTimeoutError(createTimeoutError('killed'), '@addFolder.js');
  assert.equal(finalized.error.code, ErrorCodes.TIMEOUT_WRITE_UNVERIFIED);
  assert.match(finalized.error.message, /may still have been applied/);
  assert.equal(finalized.error.details, 'killed');
});

test('a timed-out read keeps the plain timeout error', () => {
  const timeout = createTimeoutError('killed');
  assert.equal(finalizeTimeoutError(timeout, '@listProjects.js'), timeout);
  // Including the reads that are not repeatable.
  assert.equal(finalizeTimeoutError(timeout, '@diagnoseConnection.js'), timeout);
  assert.equal(finalizeTimeoutError(timeout, '@getCustomPerspectiveTasks.js'), timeout);
});

test('an error that is not a timeout is returned untouched', () => {
  const scriptError = createScriptError('boom');
  assert.equal(finalizeTimeoutError(scriptError, '@addFolder.js'), scriptError);
  const unavailable = createAppUnavailableError();
  assert.equal(finalizeTimeoutError(unavailable, '@addFolder.js'), unavailable);
});

// ------------------------------------------------------- the classification

test('every OmniJS script on disk is classified, and every entry has a file', () => {
  const onDisk = readdirSync(SCRIPTS_DIR).filter(name => name.endsWith('.js'));
  assert.ok(onDisk.length > 0, 'found no scripts: the directory path is wrong');

  // Nothing unclassified: a new script must be a deliberate decision.
  const unclassified = onDisk.filter(
    name => !READ_SCRIPTS.has(name) && !WRITE_SCRIPTS.has(name)
  );
  assert.deepEqual(unclassified, [], 'unclassified OmniJS scripts');

  // No phantom entries left behind by a rename or deletion.
  const classified = [...READ_SCRIPTS, ...WRITE_SCRIPTS];
  const missing = classified.filter(name => !onDisk.includes(name));
  assert.deepEqual(missing, [], 'classified names with no script file');

  // And no script counted as both.
  const both = [...READ_SCRIPTS].filter(name => WRITE_SCRIPTS.has(name));
  assert.deepEqual(both, [], 'scripts classified as both read and write');
});

test('no script safe to repeat contains a mutation call', () => {
  // The list above proves completeness; this proves the safe side is actually
  // safe, so a write moved into the read list is caught by the machine rather
  // than by whoever reviews the diff.
  //
  // Only the safe direction is checked: editTag.js writes purely by property
  // assignment, so a write script need not contain any of these.
  const MUTATIONS = /new (Task|Project|Folder|Tag)\(|deleteObject|markComplete|markIncomplete|markDropped|moveSections|moveTasks|markReviewed|document\.focus\s*=/;

  const offenders = [];
  for (const name of RETRY_SAFE_SCRIPTS) {
    const source = readFileSync(join(SCRIPTS_DIR, name), 'utf8');
    // Strip line comments so a mention in prose does not trip the check.
    const code = source.replace(/^\s*\/\/.*$/gm, '');
    if (MUTATIONS.test(code)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], 'scripts marked safe to repeat that look like writes');
});
