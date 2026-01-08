# of-mcp

> An MCP server for OmniFocus. Originally forked from [jqlts1/omnifocus-mcp-enhanced](https://github.com/jqlts1/omnifocus-mcp-enhanced), now maintained independently with additional features.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![macOS](https://img.shields.io/badge/macOS-only-blue.svg)](https://www.apple.com/macos/)

> **Transform OmniFocus into an AI-powered productivity powerhouse**

Enhanced Model Context Protocol (MCP) server for OmniFocus featuring **project review workflow**, **planned date support**, **repeating task support**, **native custom perspective access**, hierarchical task display, AI-optimized tool selection, and comprehensive task management. Perfect integration with Claude AI for intelligent workflows.

## ✨ Key Features

### 📋 **Project Review Workflow**
- **🔍 Find Due Reviews** - Get projects that need review with `get_projects_for_review`
- **✅ Mark Reviewed** - Mark projects as reviewed individually or in batch
- **⏰ Set Intervals** - Configure review intervals in days
- **📊 Track Progress** - View next review date, last reviewed, and interval for each project

### 📋 **Planned Date Support**
- **📅 Schedule Work** - Set when you intend to work on a task (separate from due date)
- **🔍 Filter by Planned** - Find tasks planned for today, this week, or date ranges
- **📊 Sort by Planned** - Order tasks by their planned date
- **🔄 Full CRUD** - Create, read, update, and clear planned dates

### 🔄 **Repeating Tasks**
- **📅 Flexible Frequencies** - Daily, weekly, monthly, or yearly repetition
- **🎯 Custom Intervals** - Repeat every N days/weeks/months
- **📆 Specific Days** - Weekly tasks on specific days (e.g., Mon/Wed/Fri)
- **🔁 Repeat From** - Choose to repeat from due date or completion date

### 🌟 **Native Custom Perspective Access**
- **🎯 Direct Integration** - Native access to your OmniFocus custom perspectives via `Perspective.Custom` API
- **🌳 Hierarchical Display** - Tree-style task visualization with parent-child relationships
- **🧠 AI-Optimized** - Enhanced tool descriptions prevent AI confusion between perspectives and tags
- **⚡ Zero Setup** - Works with your existing custom perspectives instantly

### 🏗️ **Complete Task Management**
- **🏗️ Subtask Support** - Create hierarchical tasks with parent-child relationships
- **📁 Folder Management** - Create and nest folders for project organization
- **🔍 Built-in Perspectives** - Access Inbox, Flagged, Forecast, and Tag-based views
- **🚀 Ultimate Task Filter** - Advanced filtering beyond OmniFocus native capabilities
- **🎯 Batch Operations** - Add/edit/remove multiple items with true batching (9-12x faster)
- **📊 Smart Querying** - Find tasks, projects, or folders by ID or name
- **🔗 Consistent ID Support** - All tools accept both IDs and names (IDs take priority for reliability)
- **🔄 Full CRUD Operations** - Create, read, update, delete tasks, projects, and folders
- **📅 Time Management** - Due dates, defer dates, planned dates, estimates, and scheduling
- **🏷️ Advanced Tagging** - Multi-tag filtering with any/all matching, exact/partial search, and auto-creation of missing tags
- **🤖 AI Integration** - Seamless Claude AI integration for intelligent workflows

## 📦 Installation

### Quick Install (Recommended)

```bash
# One-line installation
claude mcp add omnifocus-enhanced -- npx -y of-mcp
```

### Alternative Installation Methods

```bash
# Global installation
npm install -g of-mcp
claude mcp add omnifocus-enhanced -- of-mcp

# Local project installation
git clone https://github.com/mojenmojen/of-mcp.git
cd of-mcp
npm install && npm run build
claude mcp add omnifocus-enhanced -- node "/path/to/of-mcp/dist/server.js"
```

## 📋 Requirements

- **macOS 10.15+** - OmniFocus is macOS-only
- **OmniFocus 3+** - The application must be installed and running
- **OmniFocus Pro** - Required for custom perspectives (new features in v1.6.0)
- **Node.js 18+** - For running the MCP server
- **Claude Code** - For MCP integration

## 🎯 Core Capabilities

### 1. 🏗️ Subtask Management

Create complex task hierarchies with ease:

```json
// Create task in project (by name or ID)
{
  "name": "Analyze competitor keywords",
  "projectName": "SEO Strategy",
  "note": "Focus on top 10 competitors",
  "dueDate": "2025-01-15",
  "estimatedMinutes": 120,
  "tags": ["SEO", "Research"]
}

// Create task by project ID
{
  "name": "Write content outline",
  "projectId": "projectId123",
  "flagged": true,
  "estimatedMinutes": 60
}

// Create subtask by parent task ID
{
  "name": "Research top competitors",
  "parentTaskId": "loK2xEAY4H1",
  "estimatedMinutes": 30
}
```

### 2. 📁 Folder Management

Organize projects with nested folders:

```bash
# Create a top-level folder
add_folder {
  "name": "Work Projects"
}

# Create a nested folder (by name or ID)
add_folder {
  "name": "Q1 2025",
  "parentFolderName": "Work Projects"
}

add_folder {
  "name": "Marketing",
  "parentFolderId": "folderId123"
}

# Create a project in a folder (by name or ID)
add_project {
  "name": "New Website",
  "folderName": "Work Projects"
}

add_project {
  "name": "Mobile App",
  "folderId": "folderId123"
}
```

### 3. 🔍 Perspective Views

Access all major OmniFocus perspectives:

```bash
# Inbox perspective
get_inbox_tasks {"hideCompleted": true}

# Flagged tasks (filter by project name or ID)
get_flagged_tasks {"projectFilter": "SEO Project"}
get_flagged_tasks {"projectId": "abc123xyz"}

# Forecast (next 7 days)
get_forecast_tasks {"days": 7, "hideCompleted": true}

# Tasks by tag name (single or multiple)
get_tasks_by_tag {"tagName": "AI", "exactMatch": false}
get_tasks_by_tag {"tagName": ["work", "urgent", "focus"]}

# Tasks by tag ID (single or multiple)
get_tasks_by_tag {"tagId": "tagId123"}
get_tasks_by_tag {"tagId": ["tagId1", "tagId2"]}

# Tasks by multiple tags (AND - all of these tags)
get_tasks_by_tag {"tagName": ["home", "errands"], "tagMatchMode": "all"}

# List all tags (fast - ~400ms)
list_tags {}

# List all tags with task counts (slower - ~15s)
list_tags {"showTaskCounts": true}

# Include dropped/inactive tags
list_tags {"includeDropped": true}
```

### 4. 🚀 Ultimate Task Filter

Create any perspective imaginable with advanced filtering:

```bash
# Time management view (30min tasks due this week)
filter_tasks {
  "taskStatus": ["Available", "Next"],
  "estimateMax": 30,
  "dueThisWeek": true
}

# Deep work view (60+ minute tasks with notes)
filter_tasks {
  "estimateMin": 60,
  "hasNote": true,
  "taskStatus": ["Available"]
}

# Project overdue tasks (filter by name or ID)
filter_tasks {
  "projectFilter": "Website Redesign",
  "taskStatus": ["Overdue", "DueSoon"]
}

# Filter by project ID and tag ID (for programmatic use)
filter_tasks {
  "projectId": "projectId123",
  "tagId": ["tagId1", "tagId2"],
  "taskStatus": ["Available"]
}
```

### 5. 🔄 Repeating Tasks

Create and manage recurring tasks with flexible repetition rules:

```bash
# Daily repeating task
add_omnifocus_task {
  "name": "Daily standup notes",
  "projectName": "Work",
  "dueDate": "2025-01-15",
  "repetitionRule": {
    "frequency": "daily"
  }
}

# Weekly task on Mon/Wed/Fri
add_omnifocus_task {
  "name": "Exercise",
  "dueDate": "2025-01-15",
  "repetitionRule": {
    "frequency": "weekly",
    "daysOfWeek": [1, 3, 5]
  }
}

# Monthly task on the 15th, repeat from completion
add_omnifocus_task {
  "name": "Pay bills",
  "dueDate": "2025-01-15",
  "repetitionRule": {
    "frequency": "monthly",
    "dayOfMonth": 15,
    "repeatFrom": "completion"
  }
}

# Edit task to add/remove repetition
edit_item {
  "id": "taskId123",
  "itemType": "task",
  "newRepetitionRule": {"frequency": "weekly", "interval": 2}
}

# Remove repetition from a task
edit_item {
  "id": "taskId123",
  "itemType": "task",
  "newRepetitionRule": null
}

# Move a task to a different project (by ID)
edit_item {
  "id": "taskId123",
  "itemType": "task",
  "newProjectId": "projectId456"
}

# Move a project to a different folder (by ID)
edit_item {
  "id": "projectId123",
  "itemType": "project",
  "newFolderId": "folderId456"
}
```

### 6. 🌟 Native Custom Perspective Access

Access your OmniFocus custom perspectives with hierarchical task display:

```bash
# List all your custom perspectives
list_custom_perspectives {"format": "detailed"}

# Get tasks from custom perspective by name
get_custom_perspective_tasks {
  "perspectiveName": "Today's Work",  # Your custom perspective name
  "showHierarchy": true,              # Enable tree display
  "hideCompleted": true
}

# Get tasks from custom perspective by ID
get_custom_perspective_tasks {
  "perspectiveId": "perspectiveId123",
  "showHierarchy": true
}

# Examples with different perspectives
get_custom_perspective_tasks {
  "perspectiveName": "Today Review",
  "showHierarchy": true
}

get_custom_perspective_tasks {
  "perspectiveName": "Weekly Planning",
  "showHierarchy": false  # Flat display
}

# Example output (flat view):
# 1. **Review quarterly goals** [ID: j-Q4cm6ewVF]
#    Tags: planning
#    Due: 1/31/2025

# Example output (hierarchical view):
# ├─ **Launch Product Campaign**
# │  ID: abc123xyz
# │  Tags: Campaign, Priority
# │  Due: 2/15/2025
```

**Why This Is Powerful:**
- ✅ **Native Integration** - Uses OmniFocus `Perspective.Custom` API directly
- ✅ **Tree Structure** - Visual parent-child task relationships with ├─, └─ symbols
- ✅ **Task IDs Included** - Build `omnifocus:///task/{id}` deep links directly from output
- ✅ **AI-Friendly** - Enhanced descriptions prevent tool selection confusion
- ✅ **Professional Output** - Clean, readable task hierarchies

### 7. 🔍 Batch Filter Tasks

Filter tasks across multiple projects in a single call (much faster than multiple filter_tasks calls):

```bash
# Get tasks from multiple projects at once
batch_filter_tasks {
  "projectNames": ["Website Redesign", "Marketing Campaign", "Q1 Planning"],
  "taskStatus": ["Available", "Next", "Blocked"],
  "limit": 50
}

# Filter by project IDs for reliability
batch_filter_tasks {
  "projectIds": ["projectId1", "projectId2", "projectId3"],
  "taskStatus": ["Available", "Overdue"],
  "flagged": true
}

# Combine with due date filters
batch_filter_tasks {
  "projectNames": ["Daily Tasks", "Weekly Review"],
  "dueThisWeek": true,
  "sortBy": "dueDate"
}
```

**Benefits:**
- Single API call instead of N calls for N projects
- Results grouped by project with task counts
- Supports all common filters (status, flagged, due dates)
- Returns project IDs for follow-up operations

### 8. 🎯 Batch Write Operations

Efficiently manage multiple tasks with true batching (9-12x faster than individual calls):

```bash
# Batch add multiple tasks/projects (by name or ID)
batch_add_items {
  "items": [
    {
      "type": "task",
      "name": "Website Technical SEO",
      "projectName": "SEO Project",  # or use projectId
      "note": "Optimize technical aspects"
    },
    {
      "type": "task",
      "name": "Page Speed Optimization",
      "parentTaskName": "Website Technical SEO",  # or use parentTaskId
      "estimatedMinutes": 180,
      "flagged": true
    },
    {
      "type": "project",
      "name": "New Project",
      "folderId": "folderId123"  # or use folderName
    }
  ]
}

# Batch edit multiple items
batch_edit_items {
  "edits": [
    {
      "id": "taskId1",
      "itemType": "task",
      "newStatus": "completed"
    },
    {
      "id": "taskId2",
      "itemType": "task",
      "newDueDate": "2025-02-01",
      "newFlagged": true,
      "newProjectId": "projectId123"  # Move task to another project by ID
    },
    {
      "id": "projectId1",
      "itemType": "project",
      "newNote": "Updated via batch edit",
      "newFolderId": "folderId456"  # Move project to another folder by ID
    }
  ]
}

# Batch update tags (auto-creates missing tags)
batch_edit_items {
  "edits": [
    {
      "id": "taskId1",
      "itemType": "task",
      "addTags": ["urgent", "review"],
      "removeTags": ["someday"]
    },
    {
      "id": "taskId2",
      "itemType": "task",
      "replaceTags": ["priority", "work"]
    }
  ]
}

# Batch remove multiple items
batch_remove_items {
  "items": [
    {"id": "taskId1", "itemType": "task"},
    {"id": "taskId2", "itemType": "task"},
    {"name": "Old Project", "itemType": "project"}
  ]
}
```

### 9. 📋 Project Review Workflow

Automate your weekly review process:

```bash
# Get all projects due for review
get_projects_for_review {
  "includeOnHold": false,
  "limit": 50
}

# Mark a single project as reviewed
edit_item {
  "id": "projectId123",
  "itemType": "project",
  "markReviewed": true
}

# Set a project's review interval to 14 days
edit_item {
  "id": "projectId123",
  "itemType": "project",
  "newReviewInterval": 14
}

# Batch mark multiple projects as reviewed (by ID)
batch_mark_reviewed {
  "projectIds": ["projectId1", "projectId2", "projectId3"]
}

# Batch mark by project names
batch_mark_reviewed {
  "projectNames": ["Marketing Campaign", "Website Redesign"]
}

# View project review info
get_project_by_id {
  "projectName": "My Project"
}
# Returns: reviewInterval, nextReviewDate, lastReviewDate
```

**Review Workflow Benefits:**
- Automate finding projects that need attention
- Mark multiple projects reviewed in one operation
- Track when each project was last reviewed
- Set custom review intervals per project

## 🛠️ Complete Tool Reference

### 📊 Database & Task Management
1. **add_omnifocus_task** - Create tasks (enhanced with subtask support)
2. **add_project** - Create projects
3. **add_folder** - Create folders (with nesting support)
4. **remove_item** - Delete tasks or projects
5. **edit_item** - Edit tasks or projects
6. **batch_add_items** - Bulk add tasks/projects (true batching - 9x faster)
7. **batch_edit_items** - Bulk edit tasks/projects (true batching - 12x faster)
8. **batch_remove_items** - Bulk remove (true batching - 9x faster)
9. **get_task_by_id** - Query task information
10. **list_projects** - List projects with folder/status filtering

### 🔍 Built-in Perspective Tools
11. **get_inbox_tasks** - Inbox perspective
12. **get_flagged_tasks** - Flagged perspective
13. **get_forecast_tasks** - Forecast perspective (due/deferred tasks)
14. **get_tasks_by_tag** - Tag-based filtering (single or multiple tags with any/all matching)
15. **list_tags** - List all tags with task counts and hierarchy
16. **filter_tasks** - Ultimate filtering with unlimited combinations
17. **batch_filter_tasks** - Filter multiple projects in one call (faster than multiple filter_tasks)

### 🌟 Custom Perspective Tools
18. **list_custom_perspectives** - List all custom perspectives with details
19. **get_custom_perspective_tasks** - Access custom perspective with hierarchical display

### 📊 Analytics & Tracking
20. **get_today_completed_tasks** - View today's completed tasks

### 📋 Project Review Tools
21. **get_projects_for_review** - Get projects due for review
22. **batch_mark_reviewed** - Mark multiple projects as reviewed

### 🔧 Utility Tools
23. **get_server_version** - Get server version and build information
24. **get_project_by_id** - Query project information by ID or name (includes review data)
25. **get_folder_by_id** - Query folder information by ID or name

## 🚀 Quick Start Examples

### Basic Task Creation
```bash
# Simple task
add_omnifocus_task {
  "name": "Review quarterly goals",
  "projectName": "Planning",
  "dueDate": "2025-01-31"
}
```

### Advanced Task Management
```bash
# Create parent task
add_omnifocus_task {
  "name": "Launch Product Campaign",
  "projectName": "Marketing",
  "dueDate": "2025-02-15",
  "tags": ["Campaign", "Priority"]
}

# Add subtasks
add_omnifocus_task {
  "name": "Design landing page",
  "parentTaskName": "Launch Product Campaign",
  "estimatedMinutes": 240,
  "flagged": true
}
```

### Smart Task Discovery
```bash
# Find high-priority work
filter_tasks {
  "flagged": true,
  "taskStatus": ["Available"],
  "estimateMax": 120,
  "hasEstimate": true
}

# Today's completed work
filter_tasks {
  "completedToday": true,
  "taskStatus": ["Completed"],
  "sortBy": "project"
}
```

### Custom Perspective Usage
```bash
# List your custom perspectives
list_custom_perspectives {"format": "detailed"}

# Access a custom perspective with hierarchy
get_custom_perspective_tasks {
  "perspectiveName": "Today Review",
  "showHierarchy": true,
  "hideCompleted": true
}

# Quick flat view of weekly planning
get_custom_perspective_tasks {
  "perspectiveName": "Weekly Planning",
  "showHierarchy": false
}
```

## 🤖 AI Assistant Efficiency Guide

### Use `batch_filter_tasks` for Multi-Project Queries

Instead of making separate `filter_tasks` calls for each project:
```bash
# ❌ Inefficient - 5 API calls
filter_tasks { "projectFilter": "Project A", "taskStatus": [...] }
filter_tasks { "projectFilter": "Project B", "taskStatus": [...] }
filter_tasks { "projectFilter": "Project C", "taskStatus": [...] }
# ... etc
```

Use a single batch call:
```bash
# ✅ Efficient - 1 API call
batch_filter_tasks {
  "projectNames": ["Project A", "Project B", "Project C", "Project D", "Project E"],
  "taskStatus": ["Available", "Next", "Blocked", "DueSoon", "Overdue"],
  "limit": 100
}
```

### Use IDs for Reliability

All tools support both name and ID parameters. **IDs are more reliable** because they don't change when items are renamed.

| Tool | ID Parameter | Alternative To |
|------|--------------|----------------|
| `add_omnifocus_task` | `projectId` | `projectName` |
| `add_project` | `folderId` | `folderName` |
| `edit_item` | `newProjectId`, `newFolderId` | name equivalents |
| `batch_add_items` | `projectId`, `folderId` | name equivalents |
| `filter_tasks` | `projectId`, `tagId` | `projectFilter`, `tagFilter` |
| `get_tasks_by_tag` | `tagId` | `tagName` |
| `get_flagged_tasks` | `projectId` | `projectFilter` |
| `get_custom_perspective_tasks` | `perspectiveId` | `perspectiveName` |
| `batch_filter_tasks` | `projectIds` | `projectNames` |

**Rule:** When both ID and name are provided, ID takes priority.

### Batch Operations for Writes

Use batch tools for multiple write operations:
- `batch_add_items` - Add multiple tasks/projects (9x faster)
- `batch_edit_items` - Edit multiple items (12x faster)
- `batch_remove_items` - Remove multiple items (9x faster)

## 🔧 Configuration

### Verify Installation
```bash
# Check MCP status
claude mcp list

# Verify server version
get_server_version

# Test basic connection
get_inbox_tasks

# Test custom perspective features
list_custom_perspectives
```

### Troubleshooting
- Ensure OmniFocus 3+ is installed and running
- Verify Node.js 18+ is installed
- Check Claude Code MCP configuration
- Enable accessibility permissions for terminal apps if needed
- Use `get_server_version` to verify the correct version is loaded after updates

## 🎯 Use Cases

- **Project Management** - Create detailed project hierarchies with subtasks
- **GTD Workflow** - Leverage perspectives for Getting Things Done methodology
- **Time Blocking** - Filter by estimated time for schedule planning
- **Weekly Reviews** - Automate project reviews with `get_projects_for_review` and `batch_mark_reviewed`
- **Team Coordination** - Batch operations for team task assignment
- **AI-Powered Planning** - Let Claude analyze and organize your tasks

## 📈 Performance

- **True Batch Operations** - All batch tools execute in a single OmniFocus script call
  - `batch_add_items`: ~138ms per item (9x faster than individual calls)
  - `batch_edit_items`: ~76ms per item (12x faster than individual calls)
  - `batch_remove_items`: ~65ms per item (9x faster than individual calls)
- **Fast ID Lookups** - Direct `Task.byIdentifier()` / `Project.byIdentifier()` API calls
- **Lazy Loading** - OmniFocus collections only loaded when needed
- **Fast Filtering** - Native AppleScript/OmniJS performance
- **Memory Optimized** - Minimal resource usage
- **Scalable** - Handles large task databases efficiently

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Release Checklist

When releasing a new version:
1. Bump version in `package.json`
2. Update this README with any new features or tools
3. Commit and push changes

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **This Fork**: https://github.com/mojenmojen/of-mcp
- **Original Project**: https://github.com/jqlts1/omnifocus-mcp-enhanced
- **OmniFocus**: https://www.omnigroup.com/omnifocus/
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Claude Code**: https://docs.anthropic.com/en/docs/claude-code

## 🙏 Acknowledgments

Based on the original OmniFocus MCP server by [themotionmachine](https://github.com/themotionmachine/OmniFocus-MCP). Enhanced with perspective views, advanced filtering, and complete subtask support.

---

**⭐ Star this repo if it helps boost your productivity!**