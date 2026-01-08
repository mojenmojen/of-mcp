import { z } from 'zod';
import { editTag } from '../primitives/editTag.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Base schema for MCP tool definition
export const schema = z.object({
  tagId: z.string().optional()
    .describe("ID of the tag to edit"),
  tagName: z.string().optional()
    .describe("Name of the tag to edit (alternative to tagId)"),
  newName: z.string().optional()
    .describe("New name for the tag"),
  newStatus: z.enum(["active", "onHold", "dropped"]).optional()
    .describe("New status: 'active', 'onHold', or 'dropped'"),
  newParentTagId: z.string().optional()
    .describe("ID of new parent tag (use empty string to make top-level)"),
  newParentTagName: z.string().optional()
    .describe("Name of new parent tag (alternative to ID)"),
  allowsNextAction: z.boolean().optional()
    .describe("Whether tasks with this tag can be 'next' actions")
});

// Validation schema with refinements (used in handler)
const validationSchema = schema.refine(
  data => data.tagId || data.tagName,
  { message: "Either tagId or tagName is required" }
).refine(
  data => data.newName !== undefined || data.newStatus !== undefined ||
          data.newParentTagId !== undefined || data.newParentTagName !== undefined ||
          data.allowsNextAction !== undefined,
  { message: "At least one change parameter is required (newName, newStatus, newParentTagId, newParentTagName, or allowsNextAction)" }
);

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate input requirements
    const validated = validationSchema.parse(args);
    const result = await editTag(validated);

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
        text: `Error editing tag: ${errorMessage}`
      }],
      isError: true
    };
  }
}
