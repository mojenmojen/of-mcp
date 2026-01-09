#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from 'module';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Import tool definitions
import * as addOmniFocusTaskTool from './tools/definitions/addOmniFocusTask.js';
import * as addProjectTool from './tools/definitions/addProject.js';
import * as addFolderTool from './tools/definitions/addFolder.js';
import * as removeItemTool from './tools/definitions/removeItem.js';
import * as editItemTool from './tools/definitions/editItem.js';
import * as batchAddItemsTool from './tools/definitions/batchAddItems.js';
import * as batchRemoveItemsTool from './tools/definitions/batchRemoveItems.js';
import * as batchEditItemsTool from './tools/definitions/batchEditItems.js';
import * as getTaskByIdTool from './tools/definitions/getTaskById.js';
import * as getProjectByIdTool from './tools/definitions/getProjectById.js';
import * as getFolderByIdTool from './tools/definitions/getFolderById.js';
import * as getTodayCompletedTasksTool from './tools/definitions/getTodayCompletedTasks.js';
// Import perspective tools
import * as getInboxTasksTool from './tools/definitions/getInboxTasks.js';
import * as getFlaggedTasksTool from './tools/definitions/getFlaggedTasks.js';
import * as getForecastTasksTool from './tools/definitions/getForecastTasks.js';
import * as getTasksByTagTool from './tools/definitions/getTasksByTag.js';
import * as listTagsTool from './tools/definitions/listTags.js';
// Import ultimate filter tool
import * as filterTasksTool from './tools/definitions/filterTasks.js';
import * as batchFilterTasksTool from './tools/definitions/batchFilterTasks.js';
// Import custom perspective tools
import * as listCustomPerspectivesTool from './tools/definitions/listCustomPerspectives.js';
import * as getCustomPerspectiveTasksTool from './tools/definitions/getCustomPerspectiveTasks.js';
// Import review tools
import * as getProjectsForReviewTool from './tools/definitions/getProjectsForReview.js';
import * as batchMarkReviewedTool from './tools/definitions/batchMarkReviewed.js';
// Import project listing tool
import * as listProjectsTool from './tools/definitions/listProjects.js';
// Import utility tools
import * as getServerVersionTool from './tools/definitions/getServerVersion.js';
import * as diagnoseConnectionTool from './tools/definitions/diagnoseConnection.js';
// Import Sprint 8 tools
import * as searchTasksTool from './tools/definitions/searchTasks.js';
import * as duplicateProjectTool from './tools/definitions/duplicateProject.js';
import * as editTagTool from './tools/definitions/editTag.js';
// Import Sprint 10 tools
import * as systemHealthTool from './tools/definitions/systemHealth.js';
import * as completionStatsTool from './tools/definitions/completionStats.js';
import { logger } from './utils/logger.js';

// Create an MCP server
const server = new McpServer({
  name: "OmniFocus MCP",
  version: pkg.version
});

// Register tools

server.tool(
  "add_omnifocus_task",
  "Add a SINGLE task to OmniFocus. IMPORTANT: For adding 2+ tasks, use batch_add_items instead (9x faster, single API call).",
  addOmniFocusTaskTool.schema.shape,
  addOmniFocusTaskTool.handler
);

server.tool(
  "add_project",
  "Add a SINGLE project to OmniFocus. For adding multiple projects, use batch_add_items instead.",
  addProjectTool.schema.shape,
  addProjectTool.handler
);

server.tool(
  "add_folder",
  "Add a new folder to OmniFocus",
  addFolderTool.schema.shape,
  addFolderTool.handler
);

server.tool(
  "remove_item",
  "Remove a SINGLE task or project from OmniFocus. For removing 2+ items, use batch_remove_items instead (9x faster).",
  removeItemTool.schema.shape,
  removeItemTool.handler
);

server.tool(
  "edit_item",
  "Edit a SINGLE task or project in OmniFocus. For editing 2+ items, use batch_edit_items instead (12x faster).",
  editItemTool.schema.shape,
  editItemTool.handler
);

server.tool(
  "batch_add_items",
  "PREFERRED: Add multiple tasks/projects in ONE call. 9x faster than individual add_omnifocus_task calls. Always use this for 2+ items.",
  batchAddItemsTool.schema.shape,
  batchAddItemsTool.handler
);

server.tool(
  "batch_remove_items",
  "PREFERRED: Remove multiple tasks/projects in ONE call. 9x faster than individual remove_item calls. Always use this for 2+ items.",
  batchRemoveItemsTool.schema.shape,
  batchRemoveItemsTool.handler
);

server.tool(
  "batch_edit_items",
  "PREFERRED: Edit multiple tasks/projects in ONE call. 12x faster than individual edit_item calls. Always use this for 2+ items.",
  batchEditItemsTool.schema.shape,
  batchEditItemsTool.handler
);

server.tool(
  "get_task_by_id",
  "Get information about a specific task by ID or name",
  getTaskByIdTool.schema.shape,
  getTaskByIdTool.handler
);

server.tool(
  "get_project_by_id",
  "Get information about a specific project by ID or name",
  getProjectByIdTool.schema.shape,
  getProjectByIdTool.handler
);

server.tool(
  "get_folder_by_id",
  "Get information about a specific folder by ID or name",
  getFolderByIdTool.schema.shape,
  getFolderByIdTool.handler
);

server.tool(
  "get_today_completed_tasks",
  "Get tasks completed today - view today's accomplishments",
  getTodayCompletedTasksTool.schema.shape,
  getTodayCompletedTasksTool.handler
);

// Register perspective tools
server.tool(
  "get_inbox_tasks",
  "Get tasks from OmniFocus inbox perspective",
  getInboxTasksTool.schema.shape,
  getInboxTasksTool.handler
);

server.tool(
  "get_flagged_tasks", 
  "Get flagged tasks from OmniFocus with optional project filtering",
  getFlaggedTasksTool.schema.shape,
  getFlaggedTasksTool.handler
);

server.tool(
  "get_forecast_tasks",
  "Get tasks from OmniFocus forecast perspective (due/deferred tasks in date range)", 
  getForecastTasksTool.schema.shape,
  getForecastTasksTool.handler
);

server.tool(
  "get_tasks_by_tag",
  "Get tasks filtered by OmniFocus tags (labels like @home, @work, @urgent). Use this for tag-based filtering, NOT for custom perspective names. Tags are labels assigned to individual tasks.",
  getTasksByTagTool.schema.shape,
  getTasksByTagTool.handler
);

server.tool(
  "list_tags",
  "List all tags defined in OmniFocus with task counts and hierarchy",
  listTagsTool.schema.shape,
  listTagsTool.handler
);

// Ultimate filter tool - The most powerful task perspective engine
server.tool(
  "filter_tasks",
  "Advanced task filtering for ONE project. For filtering across 2+ projects, use batch_filter_tasks instead (single API call). Supports status, dates, tags, search, and more.",
  filterTasksTool.schema.shape,
  filterTasksTool.handler
);

server.tool(
  "batch_filter_tasks",
  "PREFERRED: Filter tasks across multiple projects in ONE call. Always use this instead of multiple filter_tasks calls when querying 2+ projects.",
  batchFilterTasksTool.schema.shape,
  batchFilterTasksTool.handler
);

// Custom perspective tools
server.tool(
  "list_custom_perspectives",
  "List all custom perspectives defined in OmniFocus",
  listCustomPerspectivesTool.schema.shape,
  listCustomPerspectivesTool.handler
);

server.tool(
  "get_custom_perspective_tasks",
  "Get tasks from a specific OmniFocus custom perspective by name. Use this when user refers to perspective names like 'Today', 'Daily Review', 'This Week' etc. - these are custom views created in OmniFocus, NOT tags. Supports hierarchical tree display of task relationships.",
  getCustomPerspectiveTasksTool.schema.shape,
  getCustomPerspectiveTasksTool.handler
);

// Review tools
server.tool(
  "get_projects_for_review",
  "Get projects that are due for review (next review date is in the past or today)",
  getProjectsForReviewTool.schema.shape,
  getProjectsForReviewTool.handler
);

server.tool(
  "batch_mark_reviewed",
  "Mark multiple projects as reviewed in a single operation (advances their next review dates)",
  batchMarkReviewedTool.schema.shape,
  batchMarkReviewedTool.handler
);

// Project listing tool
server.tool(
  "list_projects",
  "List projects with optional folder and status filtering - use this instead of dump_database for project discovery",
  listProjectsTool.schema.shape,
  listProjectsTool.handler
);

// Utility tools
server.tool(
  "get_server_version",
  "Get OmniFocus MCP server version and build information",
  getServerVersionTool.schema.shape,
  getServerVersionTool.handler
);

server.tool(
  "diagnose_connection",
  "Check OmniFocus connectivity, permissions, and server status. Run this first if experiencing issues.",
  diagnoseConnectionTool.schema.shape,
  diagnoseConnectionTool.handler
);

// Sprint 8: New Tools
server.tool(
  "search_tasks",
  "Full-text search across task names and notes. Simpler than filter_tasks for finding tasks by text. Supports match modes: contains, anyWord, allWords, exact.",
  searchTasksTool.schema.shape,
  searchTasksTool.handler
);

server.tool(
  "duplicate_project",
  "Create a copy of a project including all its tasks. Useful for templates and recurring workflows. Supports date shifting and hierarchy preservation.",
  duplicateProjectTool.schema.shape,
  duplicateProjectTool.handler
);

server.tool(
  "edit_tag",
  "Edit a tag's properties: rename, change status (active/onHold/dropped), move to different parent, or set allowsNextAction. Use to reactivate dropped tags or reorganize tag hierarchy.",
  editTagTool.schema.shape,
  editTagTool.handler
);

// Sprint 10: AI Assistant Optimization tools
server.tool(
  "get_system_health",
  "Get all OmniFocus health metrics in a single call. Returns counts for inbox, projects (by status), tasks (by status), tags, flagged tasks, and untagged tasks. Includes health indicators (🟢/🟡/🔴) and percentages. Much faster than multiple filter_tasks calls for dashboards.",
  systemHealthTool.schema.shape,
  systemHealthTool.handler
);

server.tool(
  "get_completion_stats",
  "Get task completion counts grouped by project, tag, or folder for a date range. Returns sorted list with counts and percentages. Much faster than multiple filter_tasks calls for analytics.",
  completionStatsTool.schema.shape,
  completionStatsTool.handler
);

// Start the MCP server
const transport = new StdioServerTransport();

logger.info(`OmniFocus MCP server v${pkg.version} starting`);

// Use await with server.connect to ensure proper connection
(async function() {
  try {
    await server.connect(transport);
    logger.info('MCP server connected');
  } catch (err) {
    logger.error('Failed to start MCP server', { error: (err as Error).message });
  }
})();

// For a cleaner shutdown if the process is terminated
