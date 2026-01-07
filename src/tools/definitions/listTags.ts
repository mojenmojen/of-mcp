import { z } from 'zod';
import { listTags } from '../primitives/listTags.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  includeDropped: z.boolean().optional().describe("Include dropped (inactive) tags in the list (default: false)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await listTags({
      includeDropped: args.includeDropped || false
    });

    return {
      content: [{
        type: "text" as const,
        text: result
      }]
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      content: [{
        type: "text" as const,
        text: `Error listing tags: ${errorMessage}`
      }],
      isError: true
    };
  }
}
