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
  finalizeUnverifiedWrite
} from '../dist/test-build/retryPolicy.mjs';
import {
  createTimeoutError,
  createAppUnavailableError,
  createScriptError,
  ErrorCodes
} from '../dist/test-build/errors.mjs';

// Whether the osascript child process was started. A failure raised after that
// point may have landed inside OmniFocus; a failure raised before it cannot
// have (issue #154, tier 2).
const DISPATCHED = true;
const NOT_DISPATCHED = false;

const WRITE_SCRIPT = '@addFolder.js';
const READ_SCRIPT = '@listProjects.js';

const SCRIPTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'utils', 'omnifocusScripts'
);

// ---------------------------------------------------------------- retrying

test('a timed-out write is not retried', () => {
  // A timeout can only be raised after dispatch: nothing else kills osascript.
  assert.equal(shouldRetry(createTimeoutError(), 0, WRITE_SCRIPT, DISPATCHED), false);
});

test('a timed-out read is still retried, up to MAX_RETRIES', () => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    assert.equal(shouldRetry(createTimeoutError(), attempt, READ_SCRIPT, DISPATCHED), true);
  }
  assert.equal(shouldRetry(createTimeoutError(), MAX_RETRIES, READ_SCRIPT, DISPATCHED), false);
});

test('a write is not retried once osascript has been started, whatever the error', () => {
  // The error type is not the thing that matters. Once the child process is
  // running, OmniFocus may already have applied the change, and no message
  // text can rule that out.
  assert.equal(shouldRetry(createAppUnavailableError(), 0, WRITE_SCRIPT, DISPATCHED), false);
});

test('a write is still retried when the attempt never reached osascript', () => {
  // Nothing was sent, so repeating it cannot duplicate anything. This is a
  // property of how far the attempt got, not of the error's type.
  assert.equal(shouldRetry(createAppUnavailableError(), 0, WRITE_SCRIPT, NOT_DISPATCHED), true);
});

test('a read is still retried after dispatch', () => {
  assert.equal(shouldRetry(createAppUnavailableError(), 0, READ_SCRIPT, DISPATCHED), true);
});

test('a non-retryable error is never retried', () => {
  assert.equal(shouldRetry(createScriptError('boom'), 0, READ_SCRIPT, DISPATCHED), false);
  assert.equal(shouldRetry(createScriptError('boom'), 0, WRITE_SCRIPT, DISPATCHED), false);
});

test('the attempt cap still applies to every retryable error', () => {
  assert.equal(shouldRetry(createAppUnavailableError(), MAX_RETRIES, READ_SCRIPT, DISPATCHED), false);
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
  assert.equal(shouldRetry(createTimeoutError(), 0, '@somethingBrandNew.js', DISPATCHED), false);
});

test('every write script is unsafe to repeat', () => {
  for (const name of WRITE_SCRIPTS) {
    assert.equal(isRetrySafeScript(name), false, `${name} must not be retried on timeout`);
    assert.equal(shouldRetry(createTimeoutError(), 0, name, DISPATCHED), false, name);
  }
});

test('the diagnostic is not retried when OmniFocus is wedged', () => {
  // diagnose_connection exists to explain an unresponsive OmniFocus. Running
  // the full ladder takes about 127s, past the two minutes a client waits, so
  // the answer arrives after the caller has given up.
  assert.equal(isRetrySafeScript('@diagnoseConnection.js'), false);
  assert.equal(shouldRetry(createTimeoutError(), 0, '@diagnoseConnection.js', DISPATCHED), false);
});

test('a read that cannot be repeated is still not retried', () => {
  // getCustomPerspectiveTasks clears document.focus and restores it at the end.
  // A run OmniFocus never finishes leaves Focus cleared; a retry then reads
  // null as the original, so it neither re-clears nor restores, and reports a
  // window that did have a Focus as having had none.
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
  const finalized = finalizeUnverifiedWrite(createTimeoutError('killed'), '@addFolder.js', DISPATCHED);
  assert.equal(finalized.error.code, ErrorCodes.TIMEOUT_WRITE_UNVERIFIED);
  assert.match(finalized.error.message, /may still have been applied/);
  assert.equal(finalized.error.details, 'killed');
});

test('a timed-out read keeps the plain timeout error', () => {
  const timeout = createTimeoutError('killed');
  assert.equal(finalizeUnverifiedWrite(timeout, '@listProjects.js', DISPATCHED), timeout);
  // Including the reads that are not repeatable.
  assert.equal(finalizeUnverifiedWrite(timeout, '@diagnoseConnection.js', DISPATCHED), timeout);
  assert.equal(finalizeUnverifiedWrite(timeout, '@getCustomPerspectiveTasks.js', DISPATCHED), timeout);
});

test('a write that fails after dispatch for any other reason is also unverified', () => {
  // osascript exits 0, so evaluateJavascript returned and the folder exists,
  // but stdout was not JSON. Reporting that as a clean failure invites the
  // caller to run it again: #154 through a different door.
  const parseFailure = createScriptError(
    'Failed to parse OmniFocus script output as JSON. Output preview: '
  );
  const finalized = finalizeUnverifiedWrite(parseFailure, '@addFolder.js', DISPATCHED);
  assert.equal(finalized.error.code, ErrorCodes.WRITE_UNVERIFIED);
  assert.match(finalized.error.message, /may still have been applied/);
  assert.match(finalized.error.message, /Failed to parse/);
  assert.equal(finalized.error.retryable, false);
  assert.ok(finalized.error.instructions.some(line => /duplicate/.test(line)));
});

test('a write that fails before dispatch is a clean failure', () => {
  // Nothing was sent to OmniFocus, so there is nothing to check for.
  const notFound = createScriptError("Script 'addFolder.js' not found");
  assert.equal(finalizeUnverifiedWrite(notFound, '@addFolder.js', NOT_DISPATCHED), notFound);
  const timeout = createTimeoutError('killed');
  assert.equal(finalizeUnverifiedWrite(timeout, '@addFolder.js', NOT_DISPATCHED), timeout);
});

test('a read that fails after dispatch is returned untouched', () => {
  const parseFailure = createScriptError('Failed to parse OmniFocus script output as JSON.');
  assert.equal(finalizeUnverifiedWrite(parseFailure, '@listProjects.js', DISPATCHED), parseFailure);
  assert.equal(finalizeUnverifiedWrite(parseFailure, '@diagnoseConnection.js', DISPATCHED), parseFailure);
});

test('an unclassified script that fails after dispatch is treated as a write', () => {
  const parseFailure = createScriptError('Failed to parse OmniFocus script output as JSON.');
  const finalized = finalizeUnverifiedWrite(parseFailure, '@somethingBrandNew.js', DISPATCHED);
  assert.equal(finalized.error.code, ErrorCodes.WRITE_UNVERIFIED);
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

// A heuristic, not a proof: it catches constructor and method mutations, and
// misses writes made by plain property assignment (editTag.js is exactly that).
// Classification is still a deliberate decision; this only stops the obvious
// mistake.
const MUTATIONS = /new (Task|Project|Folder|Tag)\(|deleteObject|markComplete|markIncomplete|markDropped|moveSections|moveTasks|markReviewed|document\.focus\s*=/;

function looksLikeAMutation(name) {
  const source = readFileSync(join(SCRIPTS_DIR, name), 'utf8');
  // Strip line comments so a mention in prose does not trip the check.
  return MUTATIONS.test(source.replace(/^\s*\/\/.*$/gm, ''));
}

test('no script safe to repeat contains a mutation call', () => {
  // The list above proves completeness; this proves the safe side is actually
  // safe, so a write moved into the read list is caught by the machine rather
  // than by whoever reviews the diff.
  assert.ok(RETRY_SAFE_SCRIPTS.size > 0, 'nothing is safe to repeat: the check would be vacuous');

  const offenders = [...RETRY_SAFE_SCRIPTS].filter(looksLikeAMutation);
  assert.deepEqual(offenders, [], 'scripts marked safe to repeat that look like writes');
});

test('the mutation pattern still recognises the writes it is meant to catch', () => {
  // Without this the test above passes forever once the pattern stops matching
  // anything -- an edit to the regex, or a refactor of the scripts to write
  // through a helper rather than `new Folder(`, would go unnoticed.
  const recognised = [...WRITE_SCRIPTS].filter(looksLikeAMutation);
  assert.ok(
    recognised.length >= 8,
    `the mutation pattern matches only ${recognised.length} of ${WRITE_SCRIPTS.size} write scripts; ` +
    'it has probably stopped matching what it was written for'
  );
});
