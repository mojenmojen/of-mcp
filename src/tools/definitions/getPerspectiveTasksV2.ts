import { z } from 'zod';
import { getPerspectiveTasksV2 } from '../primitives/getPerspectiveTasksV2.js';

// Native perspective access tool based on OmniFocus 4.2+ API
// Differences from the original get_custom_perspective tool:
// - Uses the new archivedFilterRules API for 100% accurate perspective filtering
// - Supports all 27 filter rule types
// - Automatically handles aggregation logic (all/any/none)
// - No manual filter configuration needed

export const schema = z.object({
  perspectiveName: z.string().describe("Perspective name. Use the custom perspective name you created in OmniFocus (e.g., 'Today', 'Daily Review')"),

  hideCompleted: z.boolean().optional().default(true).describe("Whether to hide completed and dropped tasks (default: true)"),

  limit: z.number().optional().default(100).describe("Maximum number of tasks to return (default: 100, set to 0 for unlimited)")
});

export type GetPerspectiveTasksV2Params = z.infer<typeof schema>;

export async function handler(params: GetPerspectiveTasksV2Params) {
  try {
    const result = await getPerspectiveTasksV2(params);
    
    if (!result.success) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: result.error
          }, null, 2)
        }]
      };
    }

    // Format the return result
    const response: any = {
      success: true,
      perspective: result.perspectiveInfo,
      tasks: result.tasks || [],
      totalTasks: result.tasks?.length || 0,
      options: {
        hideCompleted: params.hideCompleted,
        limit: params.limit
      },
      metadata: {
        timestamp: new Date().toISOString(),
        apiVersion: "v2",
        engine: "OmniFocus 4.2+ archivedFilterRules"
      }
    };

    // If there are tasks, add summary info
    if (result.tasks && result.tasks.length > 0) {
      const summary = {
        flaggedTasks: result.tasks.filter(t => t.flagged).length,
        tasksWithDueDate: result.tasks.filter(t => t.dueDate).length,
        tasksWithDeferDate: result.tasks.filter(t => t.deferDate).length,
        projectTasks: result.tasks.filter(t => t.projectName).length,
        inboxTasks: result.tasks.filter(t => !t.projectName).length
      };
      
      response.summary = summary;
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error: any) {
    console.error('getPerspectiveTasksV2 handler error:', error);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error: error.message || 'Unknown error in getPerspectiveTasksV2',
          metadata: {
            timestamp: new Date().toISOString(),
            apiVersion: "v2",
            engine: "OmniFocus 4.2+ archivedFilterRules"
          }
        }, null, 2)
      }]
    };
  }
}