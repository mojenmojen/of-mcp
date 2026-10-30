// The replies batch_add_items, batch_edit_items and batch_remove_items give.
// Pure, so it is unit-tested.
//
// The batch scripts report success only when at least one item succeeded,
// and set a top-level error only when the whole batch threw. So a batch in
// which every item failed has success: false, no error, and a full list of
// per-item results. Those results are rendered whenever there are any, so an
// all-fail batch shows each item's error instead of "undefined" (#146).

export interface BatchOutcome<R> {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: R[];
  error?: string;
}

export interface BatchReply {
  text: string;
  isError: boolean;
}

interface ItemResult {
  success: boolean;
  error?: string;
}

function renderBatchReply<R extends ItemResult>(
  result: BatchOutcome<R>,
  header: string,
  line: (item: R, index: number) => string,
  wholeFailurePrefix: string
): BatchReply {
  if (result.results.length === 0 && !result.success) {
    return {
      text: `${wholeFailurePrefix}: ${result.error || 'Unknown error'}`,
      isError: true
    };
  }

  let text = header;
  if (result.error) {
    text += `\n\n${result.error}`;
  }
  const details = result.results.map(line).join('\n');
  if (details) {
    text += `\n\n${details}`;
  }
  return { text, isError: !result.success };
}

export interface AddItemResult extends ItemResult {
  id?: string;
  name?: string;
  type?: string;
}

export function formatBatchAddReply(
  result: BatchOutcome<AddItemResult>,
  onMissingId: (item: AddItemResult, index: number) => void = () => {}
): BatchReply {
  let header: string;
  if (!result.success) {
    header = `❌ Failed to add all ${result.failureCount} items.`;
  } else {
    header = `✅ Successfully added ${result.successCount} items.`;
    if (result.failureCount > 0) {
      header += ` ⚠️ Failed to add ${result.failureCount} items.`;
    }
  }

  // Use item.name since items may be reordered; include IDs so callers can
  // reference the created items
  return renderBatchReply(result, header, (item, index) => {
    if (item.success) {
      let idText;
      if (item.id) {
        idText = ` (id: ${item.id})`;
      } else {
        onMissingId(item, index);
        idText = ' (Note: ID not available)';
      }
      return `- ✅ ${item.type}: "${item.name}"${idText}`;
    }
    return `- ❌ ${item.type || 'item'}: "${item.name || 'unknown'}" - Error: ${item.error}`;
  }, 'Failed to process batch operation');
}

export interface EditItemResult extends ItemResult {
  changedProperties?: string;
}

export interface EditRequest {
  id?: string;
  name?: string;
  itemType: string;
}

export function formatBatchEditReply(result: BatchOutcome<EditItemResult>, edits: EditRequest[]): BatchReply {
  const header = result.success
    ? `✅ Batch edit complete: ${result.successCount} succeeded` + (result.failureCount > 0 ? `, ${result.failureCount} failed` : '')
    : `❌ Batch edit failed: 0 succeeded, ${result.failureCount} failed`;

  return renderBatchReply(result, header, (item, index) => {
    const edit = edits[index];
    const identifier = edit?.id || edit?.name || `item ${index + 1}`;
    const itemType = edit?.itemType || 'item';
    if (item.success) {
      return `- ✅ ${itemType} "${identifier}": ${item.changedProperties || 'no changes'}`;
    }
    return `- ❌ ${itemType} "${identifier}": ${item.error}`;
  }, 'Failed to process batch edit');
}

export interface RemoveItemResult extends ItemResult {
  name?: string;
}

export function formatBatchRemoveReply(result: BatchOutcome<RemoveItemResult>, items: EditRequest[]): BatchReply {
  let header: string;
  if (!result.success) {
    header = `❌ Failed to remove all ${result.failureCount} items.`;
  } else {
    header = `✅ Successfully removed ${result.successCount} items.`;
    if (result.failureCount > 0) {
      header += ` ⚠️ Failed to remove ${result.failureCount} items.`;
    }
  }

  return renderBatchReply(result, header, (item, index) => {
    const request = items[index];
    const itemType = request?.itemType || 'item';
    if (item.success) {
      return `- ✅ ${itemType}: "${item.name}"`;
    }
    return `- ❌ ${itemType}: ${request?.id || request?.name} - Error: ${item.error}`;
  }, 'Failed to process batch removal');
}
