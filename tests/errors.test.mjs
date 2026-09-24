#!/usr/bin/env node
// Unit tests for the structured-error wrapper (issue #152) and for the
// write-specific timeout error (issue #154, rung 2).
//
// #152: executeOmniFocusScript threw a plain object, so the 67 sites across 45
// files that unwrap with `e instanceof Error ? e.message : String(e)` printed
// "[object Object]" and lost the message. These tests pin that the thrown value
// is a real Error whose message is the real text, while still satisfying
// isStructuredError for the handlers that read the structured fields.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OmniFocusError,
  categorizeError,
  createTimeoutError,
  createWriteTimeoutError,
  createUnverifiedWriteError,
  createPermissionError,
  createScriptError,
  isStructuredError,
  ErrorCodes
} from '../dist/test-build/errors.mjs';

// How nearly every tool handler unwraps a caught value today.
function unwrapAsHandlersDo(error) {
  return error instanceof Error ? error.message : String(error);
}

test('OmniFocusError is a real Error', () => {
  const err = new OmniFocusError(createTimeoutError('osascript killed'));
  assert.ok(err instanceof Error);
  assert.equal(err.name, 'OmniFocusError');
});

test('tool handlers get the real message, not [object Object]', () => {
  const err = new OmniFocusError(createTimeoutError('osascript killed'));
  const shown = unwrapAsHandlersDo(err);
  assert.equal(shown, 'Script execution timed out after 30 seconds');
  assert.ok(!shown.includes('[object Object]'));
});

test('the plain structured object is what used to produce [object Object]', () => {
  // Guards the premise of #152: without the wrapper the handlers show nothing useful.
  assert.equal(unwrapAsHandlersDo(createTimeoutError()), '[object Object]');
});

test('isStructuredError still recognises the wrapped error', () => {
  const err = new OmniFocusError(createPermissionError('-1743'));
  assert.ok(isStructuredError(err));
});

test('every structured field survives the wrapping', () => {
  const structured = createPermissionError('-1743 not authorized');
  const err = new OmniFocusError(structured);
  assert.equal(err.error.code, ErrorCodes.PERMISSION_DENIED);
  assert.equal(err.error.type, 'permission_denied');
  assert.equal(err.error.details, '-1743 not authorized');
  assert.equal(err.error.retryable, false);
  assert.deepEqual(err.error.instructions, structured.error.instructions);
  assert.equal(err.success, false);
});

test('the wrapped error still serialises as a structured error', () => {
  // success and error must stay own enumerable properties.
  const err = new OmniFocusError(createTimeoutError('detail'));
  const round = JSON.parse(JSON.stringify(err));
  assert.equal(round.success, false);
  assert.equal(round.error.code, ErrorCodes.TIMEOUT);
  assert.equal(round.error.message, 'Script execution timed out after 30 seconds');
});

test('a timed-out write says the change may have landed', () => {
  const err = createWriteTimeoutError('osascript killed');
  assert.equal(err.error.code, ErrorCodes.TIMEOUT_WRITE_UNVERIFIED);
  // Kept as 'timeout' so type-based matching (diagnose_connection) still works.
  assert.equal(err.error.type, 'timeout');
  assert.match(err.error.message, /may still have been applied/);
  assert.equal(err.error.details, 'osascript killed');
});

test('a timed-out write is never retryable, and says why', () => {
  const err = createWriteTimeoutError();
  assert.equal(err.error.retryable, false);
  const instructions = err.error.instructions.join(' ');
  assert.match(instructions, /NOT retried/);
  assert.match(instructions, /duplicate/);
});

test('a timed-out read keeps the existing wording', () => {
  const err = createTimeoutError();
  assert.equal(err.error.code, ErrorCodes.TIMEOUT);
  assert.equal(err.error.retryable, true);
  assert.doesNotMatch(err.error.message, /may still have been applied/);
});

// ------------------------------------------- how a timeout comes into being

// Nothing else in the codebase produces type: 'timeout' -- every other test
// starts from a hand-built createTimeoutError(). If this predicate broke, the
// error would categorise as unknown and non-retryable: no duplicate, but the
// user would silently lose the "may still have been applied" warning that #154
// exists to produce, and every other test here would still pass.

test('a child process killed by our own timeout is categorised as a timeout', () => {
  // The shape Node gives exec() when EXEC_OPTIONS.timeout fires.
  const killed = Object.assign(
    new Error('Command failed: osascript -l JavaScript /tmp/jxa_wrapper_1_abc.js'),
    { killed: true, signal: 'SIGTERM', stderr: '' }
  );
  const structured = categorizeError(killed);
  assert.equal(structured.error.type, 'timeout');
  assert.equal(structured.error.code, ErrorCodes.TIMEOUT);
  assert.equal(structured.error.retryable, true);
});

test('an exec failure that was not killed is not a timeout', () => {
  const failed = Object.assign(
    new Error('Command failed: osascript -l JavaScript /tmp/jxa_wrapper_1_abc.js'),
    { killed: false, signal: null, stderr: 'execution error: Something went wrong' }
  );
  assert.notEqual(categorizeError(failed).error.type, 'timeout');
});

// ------------------------------------ a write that failed after it was sent

test('an unverified write keeps the original message and adds the caveat', () => {
  const parseFailure = createScriptError('Failed to parse OmniFocus script output as JSON');
  const unverified = createUnverifiedWriteError(parseFailure.error);
  assert.equal(unverified.error.code, ErrorCodes.WRITE_UNVERIFIED);
  assert.equal(
    unverified.error.message,
    'Failed to parse OmniFocus script output as JSON. The change may still have been applied.'
  );
  assert.equal(unverified.error.retryable, false);
});

test('an unverified write does not double the full stop', () => {
  const ending = createUnverifiedWriteError(createScriptError('Something went wrong.').error);
  assert.equal(
    ending.error.message,
    'Something went wrong. The change may still have been applied.'
  );
});

test('an unverified write keeps the original type so nothing matching on it changes', () => {
  const unavailable = createUnverifiedWriteError(createTimeoutError('killed').error);
  assert.equal(unavailable.error.type, 'timeout');
});
