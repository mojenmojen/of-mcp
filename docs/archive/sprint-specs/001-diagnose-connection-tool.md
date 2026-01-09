# 001: Diagnose Connection Tool

## Priority: High
## Effort: Low (1-2 hours)
## Category: New Tool

---

## Problem Statement

Users frequently encounter setup issues when first configuring the MCP server:
- OmniFocus not running
- Automation permissions not granted
- Terminal app not authorized for OmniFocus automation
- OmniFocus Pro not installed (for perspective features)

Currently, users only discover these issues when a tool call fails with a cryptic error message. There's no way to proactively check if the connection is working.

---

## Proposed Solution

Add a new `diagnose_connection` tool that checks:
1. OmniFocus is running
2. Automation permissions are granted
3. Basic script execution works
4. OmniFocus version (for feature compatibility)
5. Pro license status (for perspective features)

---

## Files to Create

### `src/tools/definitions/diagnoseConnection.ts`
```typescript
import { z } from "zod";
import { diagnoseConnection } from "../primitives/diagnoseConnection.js";

export const schema = z.object({});

export async function handler() {
  return await diagnoseConnection();
}
```

### `src/tools/primitives/diagnoseConnection.ts`
```typescript
import { executeOmniFocusScript } from "../../utils/scriptExecution.js";

export async function diagnoseConnection() {
  const checks = {
    omnifocusRunning: false,
    automationPermission: false,
    scriptExecution: false,
    omnifocusVersion: null as string | null,
    isProLicense: false,
    errors: [] as string[],
    instructions: [] as string[]
  };

  try {
    // This will fail if OmniFocus not running or no permission
    const result = await executeOmniFocusScript('@diagnoseConnection.js');

    checks.omnifocusRunning = true;
    checks.automationPermission = true;
    checks.scriptExecution = true;
    checks.omnifocusVersion = result.version;
    checks.isProLicense = result.isPro;

  } catch (error: any) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('not authorized') || message.includes('-1743')) {
      checks.errors.push('Automation permission denied');
      checks.instructions.push(
        '1. Open System Settings > Privacy & Security > Automation',
        '2. Find your terminal app (Terminal, iTerm, VS Code, etc.)',
        '3. Enable the checkbox for OmniFocus',
        '4. Restart the MCP server'
      );
    } else if (message.includes('not running') || message.includes('-600')) {
      checks.errors.push('OmniFocus is not running');
      checks.instructions.push('Start OmniFocus and try again');
    } else {
      checks.errors.push(`Unknown error: ${error.message}`);
    }
  }

  return {
    success: checks.errors.length === 0,
    checks,
    summary: checks.errors.length === 0
      ? `Connected to OmniFocus ${checks.omnifocusVersion} (${checks.isProLicense ? 'Pro' : 'Standard'})`
      : `Connection failed: ${checks.errors.join(', ')}`
  };
}
```

### `src/utils/omnifocusScripts/diagnoseConnection.js`
```javascript
(() => {
  try {
    const version = app.version;
    const isPro = app.license.type === "pro";

    return JSON.stringify({
      version: version,
      isPro: isPro,
      taskCount: flattenedTasks.length,
      projectCount: flattenedProjects.length
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
})()
```

---

## Files to Modify

### `src/server.ts`
Add import and register the tool:
```typescript
import * as diagnoseConnectionTool from './tools/definitions/diagnoseConnection.js';

server.tool(
  "diagnose_connection",
  "Check OmniFocus connectivity, permissions, and server status. Run this first if experiencing issues.",
  diagnoseConnectionTool.schema.shape,
  diagnoseConnectionTool.handler
);
```

---

## Implementation Notes

- This should be the first tool users run when troubleshooting
- Error messages should be actionable with step-by-step instructions
- The tool should never throw - always return a structured response
- Consider adding this check to server startup (log warning if fails)

---

## Acceptance Criteria

- [ ] Tool returns success when OmniFocus is running and permissions granted
- [ ] Tool returns clear error + instructions when permission denied
- [ ] Tool returns clear error + instructions when OmniFocus not running
- [ ] Tool reports OmniFocus version
- [ ] Tool reports Pro vs Standard license
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Permission Handling and Error Recovery" section
- PERFORMANCE_AND_PATTERNS.md: "Tool Gap Analysis" - diagnose_connection listed as high value
