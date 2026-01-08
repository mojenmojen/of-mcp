import { z } from 'zod';
import { duplicateProject } from '../primitives/duplicateProject.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Base schema for MCP tool definition
export const schema = z.object({
  sourceProjectId: z.string().optional()
    .describe("ID of project to duplicate"),
  sourceProjectName: z.string().optional()
    .describe("Name of project to duplicate (if ID not provided)"),
  newName: z.string()
    .describe("Name for the duplicated project"),
  folderName: z.string().optional()
    .describe("Folder to place the new project in"),
  folderId: z.string().optional()
    .describe("Folder ID to place the new project in"),
  resetDates: z.boolean().optional().default(true)
    .describe("Clear all dates (defer, due) from duplicated tasks"),
  shiftDates: z.object({
    referenceDate: z.string().describe("New start date (ISO format)"),
    basedOn: z.enum(["defer", "due"]).default("defer")
      .describe("Which date to use as reference for shifting")
  }).optional()
    .describe("Shift all dates relative to a new start date (overrides resetDates)"),
  clearCompleted: z.boolean().optional().default(true)
    .describe("Reset all tasks to incomplete status"),
  copyNotes: z.boolean().optional().default(true)
    .describe("Copy task notes"),
  copyTags: z.boolean().optional().default(true)
    .describe("Copy task tags")
});

// Validation schema with refinement (used in handler)
const validationSchema = schema.refine(
  data => data.sourceProjectId || data.sourceProjectName,
  { message: "Either sourceProjectId or sourceProjectName is required" }
);

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that either sourceProjectId or sourceProjectName is provided
    const validated = validationSchema.parse(args);
    const result = await duplicateProject(validated);

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
        text: `Error duplicating project: ${errorMessage}`
      }],
      isError: true
    };
  }
}
