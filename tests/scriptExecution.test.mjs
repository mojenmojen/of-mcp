#!/usr/bin/env node
// Tests at the real throw site (issues #152 and #154).
//
// These need no OmniFocus: a script name that does not exist fails before any
// osascript call, which is enough to pin the shape of what executeOmniFocusScript
// throws. Before #152 it threw a plain object and every tool handler printed
// "[object Object]".

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Note on the bundles: test:unit builds errors.ts on its own AND inlines it into
// scriptExecution.mjs, so each bundle carries its own copy of the OmniFocusError
// class. Structural checks (instanceof Error, isStructuredError) work across the
// two, which is what the assertions below rely on; `instanceof OmniFocusError`
// across bundles would silently be false.

// Set before importing, because the logger reads it when the module loads.
process.env.LOG_LEVEL = 'silent';
const { executeOmniFocusScript } = await import('../dist/test-build/scriptExecution.mjs');
const { isStructuredError } = await import('../dist/test-build/errors.mjs');

test('a failure is thrown as a real Error carrying its message', async () => {
  await assert.rejects(
    executeOmniFocusScript('@thisScriptDoesNotExist.js'),
    (error) => {
      assert.ok(error instanceof Error, 'must be an Error');
      // What the tool handlers would show the user.
      const shown = error instanceof Error ? error.message : String(error);
      assert.match(shown, /thisScriptDoesNotExist\.js/);
      assert.ok(!shown.includes('[object Object]'));
      return true;
    }
  );
});

test('the thrown Error is still a structured error', async () => {
  await assert.rejects(
    executeOmniFocusScript('@thisScriptDoesNotExist.js'),
    (error) => {
      assert.ok(isStructuredError(error));
      assert.equal(error.success, false);
      assert.equal(typeof error.error.code, 'string');
      return true;
    }
  );
});

test('a write that fails before osascript starts is still a clean failure', async () => {
  // Reading the script file throws before the child process is created, so
  // nothing reached OmniFocus. The name is a write script's, so this fails only
  // if the dispatch flag is wired wrongly -- which would tell every caller with
  // a missing script that their change may have been applied (issue #154).
  await assert.rejects(
    executeOmniFocusScript('/tmp/of-mcp-no-such-directory/addFolder.js'),
    (error) => {
      assert.ok(
        !/may still have been applied/.test(error.message),
        `warned about an unapplied change: ${error.message}`
      );
      assert.notEqual(error.error.code, 'WRITE_UNVERIFIED');
      assert.notEqual(error.error.code, 'TIMEOUT_WRITE_UNVERIFIED');
      return true;
    }
  );
});
