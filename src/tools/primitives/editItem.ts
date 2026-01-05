import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { RepetitionRule } from './addOmniFocusTask.js';

// Status options for tasks and projects
type TaskStatus = 'incomplete' | 'completed' | 'dropped';
type ProjectStatus = 'active' | 'completed' | 'dropped' | 'onHold';

// Interface for item edit parameters
export interface EditItemParams {
  id?: string;                  // ID of the task or project to edit
  name?: string;                // Name of the task or project to edit (as fallback if ID not provided)
  itemType: 'task' | 'project'; // Type of item to edit

  // Common editable fields
  newName?: string;             // New name for the item
  newNote?: string;             // New note for the item
  newDueDate?: string;          // New due date in ISO format (empty string to clear)
  newDeferDate?: string;        // New defer date in ISO format (empty string to clear)
  newPlannedDate?: string;      // New planned date in ISO format (empty string to clear)
  newFlagged?: boolean;         // New flagged status (false to remove flag, true to add flag)
  newEstimatedMinutes?: number; // New estimated minutes

  // Task-specific fields
  newStatus?: TaskStatus;       // New status for tasks (incomplete, completed, dropped)
  dropCompletely?: boolean;     // When dropping repeating task, true = drop completely (no future occurrences)
  addTags?: string[];           // Tags to add to the task
  removeTags?: string[];        // Tags to remove from the task
  replaceTags?: string[];       // Tags to replace all existing tags with
  newRepetitionRule?: RepetitionRule | null; // New repetition rule (null to remove, object to set)

  // Task movement fields
  newProjectName?: string;      // Move task to a different project
  newParentTaskId?: string;     // Move task to be a subtask of another task (by ID)
  newParentTaskName?: string;   // Move task to be a subtask of another task (by name)
  moveToInbox?: boolean;        // Move task to inbox

  // Project-specific fields
  newSequential?: boolean;      // Whether the project should be sequential
  newFolderName?: string;       // New folder to move the project to
  newProjectStatus?: ProjectStatus; // New status for projects

  // Project review fields
  markReviewed?: boolean;       // Mark project as reviewed (advances next review date)
  newReviewInterval?: number;   // Set new review interval in days
}

/**
 * Edit a task or project in OmniFocus
 * Uses OmniJS to avoid AppleScript escaping issues with special characters like $
 */
export async function editItem(params: EditItemParams): Promise<{
  success: boolean,
  id?: string,
  name?: string,
  changedProperties?: string,
  error?: string
}> {
  try {
    // Validate parameters
    if (!params.id && !params.name) {
      return {
        success: false,
        error: "Either id or name must be provided"
      };
    }

    console.error("Executing OmniJS script for editItem...");
    console.error(`Item type: ${params.itemType}, ID: ${params.id || 'not provided'}, Name: ${params.name || 'not provided'}`);

    // Execute the OmniJS script with all parameters
    const result = await executeOmniFocusScript('@editTask.js', {
      id: params.id || null,
      name: params.name || null,
      itemType: params.itemType,
      newName: params.newName,
      newNote: params.newNote,
      newDueDate: params.newDueDate,
      newDeferDate: params.newDeferDate,
      newPlannedDate: params.newPlannedDate,
      newFlagged: params.newFlagged,
      newEstimatedMinutes: params.newEstimatedMinutes,
      newStatus: params.newStatus,
      dropCompletely: params.dropCompletely || false,
      addTags: params.addTags,
      removeTags: params.removeTags,
      replaceTags: params.replaceTags,
      newRepetitionRule: params.newRepetitionRule,
      newProjectName: params.newProjectName,
      newParentTaskId: params.newParentTaskId,
      newParentTaskName: params.newParentTaskName,
      moveToInbox: params.moveToInbox,
      newSequential: params.newSequential,
      newFolderName: params.newFolderName,
      newProjectStatus: params.newProjectStatus,
      markReviewed: params.markReviewed,
      newReviewInterval: params.newReviewInterval
    });

    // Parse result
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        console.error("Failed to parse result as JSON:", e);
        return {
          success: false,
          error: `Failed to parse result: ${result}`
        };
      }
    } else {
      parsed = result;
    }

    if (parsed.success) {
      return {
        success: true,
        id: parsed.id,
        name: parsed.name,
        changedProperties: parsed.changedProperties
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in editItem:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in editItem"
    };
  }
}
