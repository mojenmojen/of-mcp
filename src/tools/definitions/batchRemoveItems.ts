import { z } from 'zod';
import { batchRemoveItems, BatchRemoveItemsParams } from '../primitives/batchRemoveItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { formatBatchRemoveReply } from '../../utils/batchReply.js';

const log = logger.child('def:batchRemoveItems');

export const schema = z.object({
  items: z.array(z.object({
    id: z.string().optional().describe("The ID of the task or project to remove"),
    name: z.string().optional().describe("The name of the task or project to remove (as fallback if ID not provided)"),
    itemType: z.enum(['task', 'project']).describe("Type of item to remove ('task' or 'project')")
  })).describe("Array of items (tasks or projects) to remove")
});

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that each item has at least an ID or name
    for (const item of args.items) {
      if (!item.id && !item.name) {
        return {
          content: [{
            type: "text" as const,
            text: "Each item must have either id or name provided to remove it."
          }],
          isError: true
        };
      }
    }
    
    // Call the batchRemoveItems function (now uses true batching - single OmniJS script)
    const result = await batchRemoveItems(args.items as BatchRemoveItemsParams[]);

    const reply = formatBatchRemoveReply(result, args.items);

    return {
      content: [{
        type: "text" as const,
        text: reply.text
      }],
      ...(reply.isError ? { isError: true } : {})
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Tool execution error', { error: errorMessage });
    return {
      content: [{
        type: "text" as const,
        text: `Error processing batch removal: ${errorMessage}`
      }],
      isError: true
    };
  }
} 