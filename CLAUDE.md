# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build the project
npm run build

# Start development (watch mode)
npm run dev

# Start the server
npm run start

# Test (manual testing required with OmniFocus)
npm run test
```

The build process compiles TypeScript to JavaScript and copies OmniJS script files to the dist directory.

## Architecture Overview

This is an enhanced Model Context Protocol (MCP) server that provides AI assistants with comprehensive OmniFocus task management capabilities through AppleScript and OmniJS integration.

### Core Architecture

**MCP Server Entry Point**: `src/server.ts`
- Registers 24 tools for OmniFocus operations
- Uses `@modelcontextprotocol/sdk` for MCP protocol handling
- Supports both individual and batch operations (with true batching for 9-12x performance)

**Tool Organization**: 
- `src/tools/definitions/` - MCP tool definitions with schemas and handlers
- `src/tools/primitives/` - Core implementation functions
- Tools mirror each other between definitions (MCP interface) and primitives (implementation)

**Script Execution Architecture**:
- `src/utils/scriptExecution.ts` - Executes OmniJS scripts within OmniFocus
- `src/utils/omnifocusScripts/` - Collection of .js files containing OmniJS code
- `src/utils/applescriptUtils.ts` - AppleScript string escaping and JSON handling utilities

### Key Components

**Data Types** (`src/types.ts`):
- `OmnifocusTask` - Complete task structure with hierarchical relationships
- `OmnifocusProject`, `OmnifocusFolder`, `OmnifocusTag` - Supporting entities
- `OmnifocusDatabase` - Full database export structure

**Perspective Engine** (`src/utils/perspectiveEngine.ts`):
- Advanced filtering system beyond native OmniFocus capabilities
- Supports complex queries combining status, dates, estimates, tags, and projects

**Custom Perspective Support**:
- Native integration with OmniFocus `Perspective.Custom` API
- Hierarchical task display with tree visualization
- Tools: `listCustomPerspectives`, `getCustomPerspectiveTasks`

### Tool Categories

1. **Task Management**: `add_omnifocus_task`, `edit_item`, `remove_item`, `get_task_by_id`
2. **Project Management**: `add_project`, `list_projects`, `get_project_by_id`
3. **Folder Management**: `add_folder`, `get_folder_by_id`
4. **Batch Operations**: `batch_add_items`, `batch_edit_items`, `batch_remove_items` (true batching - 9-12x faster)
5. **Built-in Perspectives**: `get_inbox_tasks`, `get_flagged_tasks`, `get_forecast_tasks`, `get_tasks_by_tag`
6. **Advanced Filtering**: `filter_tasks` (most powerful filtering engine)
7. **Custom Perspectives**: `list_custom_perspectives`, `get_custom_perspective_tasks`
8. **Review Workflow**: `get_projects_for_review`, `batch_mark_reviewed`
9. **Analytics**: `get_today_completed_tasks`
10. **Utility**: `get_server_version`

## Development Notes

**macOS-Only**: This project requires macOS and OmniFocus 3+ to function. OmniFocus Pro is required for custom perspective features.

**Script Execution Pattern**:
- OmniJS scripts (.js files) contain the actual OmniFocus automation logic
- TypeScript functions execute these scripts via `executeOmniFocusScript()`
- Results are parsed as JSON and returned through MCP protocol

**Error Handling**: AppleScript execution errors are caught and propagated through the MCP protocol with descriptive error messages.

**Subtask Support**: Enhanced with hierarchical task relationships using `parentTaskName` or `parentTaskId` parameters.

**Testing**: Manual testing required with OmniFocus application. No automated test suite due to AppleScript/OmniFocus dependency.

**Version Management**:
- **IMPORTANT**: Bump the version in `package.json` every time code changes are made
- **IMPORTANT**: Update `README.md` when adding new tools or features
- The version in `src/server.ts` is read automatically from `package.json` (single source of truth)
- Use semantic versioning: patch (x.x.X) for fixes, minor (x.X.0) for new features, major (X.0.0) for breaking changes
- The `get_server_version` tool allows verifying which version is running in a Claude session