#!/usr/bin/env node
// Unit tests for the structured-error wrapper (issue #152) and for the
// write-specific timeout error (issue #154, rung 2).
//
// #152: executeOmniFocusScript threw a plain object, so the ~72 tool handlers
// that unwrap with `e instanceof Error ? e.message : String(e)` printed
// "[object Object]" and lost the message. These tests pin that the thrown value
// is a real Error whose message is the real text, while still satisfying
// isStructuredError for the handlers that read the structured fields.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OmniFocusError,
  createTimeoutError,
  createWriteTimeoutError,
  createPermissionError,
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
