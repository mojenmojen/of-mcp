import { z } from 'zod';
import { getSystemHealth } from '../primitives/systemHealth.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await getSystemHealth();

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
        text: `Error getting system health: ${errorMessage}`
      }],
      isError: true
    };
  }
}
