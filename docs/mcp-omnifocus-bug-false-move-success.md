# Bug Report: False "moved to folder" Success Message

## Summary
`edit_item` reports success for moving a project to a folder it's already in, with misleading message "moved to folder".

## Steps to Reproduce
1. Have a project already in folder "activities"
2. Call `edit_item` with `newFolderName: "activities"` for that project
3. Observe success message: `✅ Project "create" updated successfully (moved to folder).`

## Expected Behavior
One of:
- Detect project is already in target folder and report: `Project "create" is already in folder "activities" - no changes made.`
- Return a different status indicating no-op
- At minimum, don't claim it "moved" something that didn't move

## Actual Behavior
Reports success with "(moved to folder)" even when no move occurred.

## Impact
- Misleading to users/automations
- Can't distinguish between actual moves and no-ops
- Makes debugging harder when automation reports success but nothing happened

## Suggested Fix
Before executing move, check if `project.folder.name === targetFolderName`. If so, return early with appropriate message.

```javascript
// Pseudocode
if (project.folder && project.folder.name() === targetFolderName) {
  return `Project "${projectName}" is already in folder "${targetFolderName}" - no changes made.`;
}
```

## Discovered
2026-01-06 during omnifocus-audit skill testing

## Severity
Low - cosmetic/UX issue, not data corruption
