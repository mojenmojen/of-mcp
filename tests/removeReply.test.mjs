#!/usr/bin/env node
// Unit tests for the replies remove_item and batch_remove_items give when a
// project was removed by a name that two or more projects matched (#149). The
// scripts then return the removed project's status and how many other
// projects of that name matched, and the reply names the project's ID and
// status and how many of that name remain. A removal by ID or by a unique
// name keeps today's reply.
//
// The module is imported as a namespace, so a missing helper fails its own
// test rather than the whole file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as reply from '../dist/test-build/batchReply.mjs';

const removedOne = (item) => ({ success: true, successCount: 1, failureCount: 0, results: [item] });

test('remove_item: a project removed by a shared name names its ID and status, and how many remain (#149)', () => {
  assert.equal(
    reply.formatRemoveItemReply('project', { id: 'abc123', name: 'SMOKE-dup', status: 'Active', otherMatches: 2 }),
    '✅ Project "SMOKE-dup" (id: abc123, Active) removed successfully. 2 other projects named "SMOKE-dup" remain.'
  );
});

test('remove_item: with one other project of that name, the count is singular (#149)', () => {
  assert.equal(
    reply.formatRemoveItemReply('project', { id: 'abc123', name: 'SMOKE-dup', status: 'OnHold', otherMatches: 1 }),
    '✅ Project "SMOKE-dup" (id: abc123, OnHold) removed successfully. 1 other project named "SMOKE-dup" remains.'
  );
});

test('remove_item: a removal by ID or by a unique name keeps today\'s reply (#149)', () => {
  assert.equal(
    reply.formatRemoveItemReply('project', { id: 'p1', name: 'SMOKE-solo' }),
    '✅ Project "SMOKE-solo" removed successfully.'
  );
  assert.equal(
    reply.formatRemoveItemReply('task', { id: 't1', name: 'SMOKE-task' }),
    '✅ Task "SMOKE-task" removed successfully.'
  );
});

test('batch_remove_items: a project removed by a shared name names its ID and status, and how many remain (#149)', () => {
  const result = reply.formatBatchRemoveReply(
    removedOne({ success: true, id: 'abc123', name: 'SMOKE-dup', status: 'Active', otherMatches: 2 }),
    [{ itemType: 'project', name: 'SMOKE-dup' }]
  );
  assert.equal(
    result.text,
    '✅ Successfully removed 1 items.\n\n- ✅ project: "SMOKE-dup" (id: abc123, Active). 2 other projects named "SMOKE-dup" remain.'
  );
});

test('batch_remove_items: with one other project of that name, the count is singular (#149)', () => {
  const result = reply.formatBatchRemoveReply(
    removedOne({ success: true, id: 'abc123', name: 'SMOKE-dup', status: 'Active', otherMatches: 1 }),
    [{ itemType: 'project', name: 'SMOKE-dup' }]
  );
  assert.equal(
    result.text,
    '✅ Successfully removed 1 items.\n\n- ✅ project: "SMOKE-dup" (id: abc123, Active). 1 other project named "SMOKE-dup" remains.'
  );
});

// From the review: the ID and the count are the point of the shared-name
// reply, so they stay even if the status could not be read.
test('remove_item and batch_remove_items: an unreadable status still shows the ID and how many remain (#149)', () => {
  const item = { success: true, id: 'abc123', name: 'SMOKE-dup', status: null, otherMatches: 2 };
  assert.equal(
    reply.formatRemoveItemReply('project', item),
    '✅ Project "SMOKE-dup" (id: abc123, status unreadable) removed successfully. 2 other projects named "SMOKE-dup" remain.'
  );
  assert.equal(
    reply.formatBatchRemoveReply(removedOne(item), [{ itemType: 'project', name: 'SMOKE-dup' }]).text,
    '✅ Successfully removed 1 items.\n\n- ✅ project: "SMOKE-dup" (id: abc123, status unreadable). 2 other projects named "SMOKE-dup" remain.'
  );
});

// Today's line, so this passed before the change too.
test('batch_remove_items: a removal by ID or by a unique name keeps today\'s line (#149)', () => {
  const result = reply.formatBatchRemoveReply(
    removedOne({ success: true, id: 'p1', name: 'SMOKE-solo' }),
    [{ itemType: 'project', name: 'SMOKE-solo' }]
  );
  assert.equal(result.text, '✅ Successfully removed 1 items.\n\n- ✅ project: "SMOKE-solo"');
});
