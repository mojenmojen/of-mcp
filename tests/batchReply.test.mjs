#!/usr/bin/env node
// Unit tests for the batch tool replies (src/utils/batchReply.ts). The case
// that matters is a batch in which every item failed: the scripts report
// success: false with no top-level error, and the reply must still show each
// item's error rather than "undefined" (#146).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBatchAddReply,
  formatBatchEditReply,
  formatBatchRemoveReply,
} from '../dist/test-build/batchReply.mjs';

const AMBIGUOUS = 'Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: f-nested), "Archive" (id: f-top). Use the full "Parent > Child" path, or pass folderId.';

// The shape the scripts return when every item fails: success follows
// successCount > 0, and no top-level error is set.
const allFailed = (results) => ({ success: false, successCount: 0, failureCount: results.length, results });

test('batch_add_items: an all-fail batch shows each item error and is an error (#146)', () => {
  const reply = formatBatchAddReply(allFailed([
    { success: false, type: 'project', name: 'New', error: AMBIGUOUS },
  ]));
  assert.equal(reply.isError, true);
  assert.equal(reply.text, `❌ Failed to add all 1 items.\n\n- ❌ project: "New" - Error: ${AMBIGUOUS}`);
  assert.doesNotMatch(reply.text, /undefined/);
});

test('batch_edit_items: an all-fail batch shows each item error and is an error (#146)', () => {
  const reply = formatBatchEditReply(
    allFailed([{ success: false, error: AMBIGUOUS }]),
    [{ id: 'p1', itemType: 'project' }]
  );
  assert.equal(reply.isError, true);
  assert.equal(reply.text, `❌ Batch edit failed: 0 succeeded, 1 failed\n\n- ❌ project "p1": ${AMBIGUOUS}`);
});

test('batch_remove_items: an all-fail batch shows each item error and is an error (#146)', () => {
  const reply = formatBatchRemoveReply(
    allFailed([
      { success: false, error: 'Task not found' },
      { success: false, error: 'Project not found' },
    ]),
    [{ id: 't1', itemType: 'task' }, { name: 'Gone', itemType: 'project' }]
  );
  assert.equal(reply.isError, true);
  assert.equal(
    reply.text,
    '❌ Failed to remove all 2 items.\n\n- ❌ task: t1 - Error: Task not found\n- ❌ project: Gone - Error: Project not found'
  );
});

test('a partly failed batch is unchanged: success header, every line, not an error', () => {
  const reply = formatBatchEditReply(
    { success: true, successCount: 1, failureCount: 1, results: [
      { success: true, changedProperties: 'name' },
      { success: false, error: AMBIGUOUS },
    ] },
    [{ id: 'p1', itemType: 'project' }, { name: 'Other', itemType: 'project' }]
  );
  assert.equal(reply.isError, false);
  assert.equal(
    reply.text,
    `✅ Batch edit complete: 1 succeeded, 1 failed\n\n- ✅ project "p1": name\n- ❌ project "Other": ${AMBIGUOUS}`
  );
});

test('a whole-batch failure with no per-item results keeps its error message', () => {
  const thrown = { success: false, successCount: 0, failureCount: 2, results: [], error: 'Batch operation failed: boom' };
  assert.deepEqual(formatBatchAddReply(thrown), {
    text: 'Failed to process batch operation: Batch operation failed: boom', isError: true,
  });
  assert.deepEqual(formatBatchEditReply(thrown, []), {
    text: 'Failed to process batch edit: Batch operation failed: boom', isError: true,
  });
  assert.deepEqual(formatBatchRemoveReply(thrown, []), {
    text: 'Failed to process batch removal: Batch operation failed: boom', isError: true,
  });
});

test('batch_add_items: a success with no ID is reported and noted', () => {
  const missing = [];
  const reply = formatBatchAddReply(
    { success: true, successCount: 1, failureCount: 0, results: [{ success: true, type: 'task', name: 'A' }] },
    (item, index) => missing.push([item.name, index])
  );
  assert.equal(reply.text, '✅ Successfully added 1 items.\n\n- ✅ task: "A" (Note: ID not available)');
  assert.deepEqual(missing, [['A', 0]]);
});
