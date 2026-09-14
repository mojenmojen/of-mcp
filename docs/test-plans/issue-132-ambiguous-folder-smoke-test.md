# Issue #132 smoke test — ambiguous folder names

## Setup (build-freshness gate, per #126)

Run every case through the throwaway stdio harness (see Harness below), NOT
through the MCP server configured in your client. That server runs the main
checkout's `dist/server.js`, so it would exercise `main` rather than this
branch — and rebuilding the main checkout with unmerged code would put it
into daily use.

1. `npm run build:fast` in the worktree.
2. Through the harness, call `get_server_version` and confirm version
   `1.34.0`, `build.commit` equal to `git rev-parse --short HEAD`, and
   `buildStale: false`.

## Harness

The harness file goes in the worktree root, is never committed, and is deleted after the run.

```javascript
// Throwaway harness for the #142 smoke test. Do not commit.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const client = new Client({ name: 'smoke-142', version: '0.0.0' });
await client.connect(new StdioClientTransport({
  command: 'node',
  args: [fileURLToPath(new URL('./dist/server.js', import.meta.url))],
}));

const [tool, json] = process.argv.slice(2);
const result = await client.callTool({ name: tool, arguments: JSON.parse(json || '{}') });
console.log(result.content.map(c => c.text).join('\n'));
if (result.isError) process.exitCode = 1;
await client.close();
```

Example: `node smoke-142.mjs add_folder '{"name":"SMOKE-parent"}'`

## Fixtures

Create two folders that share a name, one nested:
- `SMOKE-dup` at the top level
- `SMOKE-parent > SMOKE-dup`

## Cases

| # | Call | Expected |
|---|------|----------|
| TC1 | `add_project` with `folderName: "SMOKE-dup"` | Error naming both candidates by full path; **no project created** |
| TC2 | `add_project` with `folderName: "SMOKE-parent > SMOKE-dup"` | Succeeds, project lands in the nested folder |
| TC3 | `add_project` with the nested folder's `folderId` | Succeeds |
| TC4 | `batch_add_items` with one item using `folderName: "SMOKE-dup"` and one unambiguous item | Ambiguous item errors; the other still succeeds |
| TC5 | `edit_item` with `newFolderName: "SMOKE-dup"` | Error; **verify no third `SMOKE-dup` folder was created** |
| TC6 | `batch_edit_items` with `newFolderName: "SMOKE-dup"` | Error; **verify no third folder created** |
| TC7 | `list_projects` with `folderName: "SMOKE-dup"` | Error naming both candidates |
| TC8 | `get_folder_by_id` with `folderName: "SMOKE-dup"` | Error naming both candidates |
| TC9 | `list_projects` with a unique `folderName` | Unchanged behaviour — regression check |
| TC10 | `edit_item` with `newFolderName: "SMOKE-brand-new"` (no match) | Still creates the folder — the not-found path must be preserved |
| TC11 | `add_folder` with `name: "SMOKE-child"`, `parentFolderName: "SMOKE-dup"` | Error naming both candidates; **no folder created** |
| TC12 | `list_projects` with both a matching `folderId` (the nested folder) and the ambiguous `folderName: "SMOKE-dup"` | Succeeds — `folderId` takes priority and the ambiguous name is never consulted |

TC5, TC6 and TC10 are the critical ones: they prove ambiguity is distinguished
from not-found rather than collapsed into it.
TC5, TC6 and TC10 operate on the project created in TC2.
TC12 was added during the run (it is not in issue #142's original case list)
to verify one implementation decision: that `list_projects`' `folderId`
parameter takes priority over `folderName`, so passing both never triggers the
ambiguity error. It is read-only.

## Cleanup

Remove every project created by TC2/TC3/TC4 with `remove_item`. of-mcp has no
folder-delete tool, so remove both `SMOKE-dup` folders, `SMOKE-parent`, and
`SMOKE-brand-new` (created by TC10) with a one-off guarded OmniJS call —
`Folder.byIdentifier(id)` then `deleteObject(folder)` inside
`app.evaluateJavascript`, refusing unless the name matches and the folder is
empty (repo precedent: `removeTask.js:61`).

---

## Results

**Note:** after this run, the ambiguity message gained each candidate's folder ID, e.g. `"Clients > Archive" (id: <id>)`. The strings below are as recorded before that change.

Executed 2026-09-12 against the worktree build, via the disposable
`smoke-142.mjs` stdio harness (never committed), against the user's live
OmniFocus database, using only disposable `SMOKE-*` fixtures.

### Gate

- `git status --short`: clean. `git log -1 --oneline`: `d23ff50`.
- `npm run build:fast`: exit 0. `write-build-info: dist/build-info.json (d23ff50)`, `dirty: false`.
- `get_server_version` via the harness returned:
  - `version`: `1.34.0`
  - `build.commit`: `d23ff50`
  - `build.dirty`: `false`
  - `build.buildStale`: `false`

Gate PASSED.

### Pre-check

`get_folder_by_id` for `SMOKE-dup`, `SMOKE-parent`, `SMOKE-brand-new` and
`SMOKE-child` each returned `Failed to retrieve folder: Folder not found`.
No leftovers from a prior run. Proceeded to create fixtures.

### Fixtures created

- `add_folder {"name":"SMOKE-dup"}` → created at root level, id `<id>`.
- `add_folder {"name":"SMOKE-parent"}` → created at root level, id `<id>`.
- `add_folder {"name":"SMOKE-dup","parentFolderId":"<id>"}` (inside
  `SMOKE-parent`) → created inside "SMOKE-parent", id `<id>`.

### Case results

**TC1** — `add_project {"name":"SMOKE-TC1","folderName":"SMOKE-dup"}`
Output: `Failed to create project: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.`
Verification: `list_projects` scoped to the top-level `SMOKE-dup` folder id and to the nested `SMOKE-dup` folder id both returned 0 projects. `get_project_by_id {"projectName":"SMOKE-TC1"}` returned `Failed to retrieve project: Project not found`, ruling out the project having landed anywhere unexpected (e.g. root).
**PASS.**

**TC2** — `add_project {"name":"SMOKE-TC2","folderName":"SMOKE-parent > SMOKE-dup"}`
Output: `✅ Project "SMOKE-TC2" (id: <id>) created successfully in folder "SMOKE-parent > SMOKE-dup" (parallel).`
**PASS.**

**TC3** — `add_project {"name":"SMOKE-TC3","folderId":"<nested SMOKE-dup id>"}`
Output: `✅ Project "SMOKE-TC3" (id: <id>) created successfully at the root level (parallel).`
Verification: the confirmation text says "at the root level", which looked like a placement bug. `list_projects` scoped to the nested folder id, and `get_project_by_id`, both confirmed SMOKE-TC3 is actually filed under "SMOKE-parent > SMOKE-dup" — the project *is* in the right place; only the success message's placement text is wrong when a project is created by `folderId` directly. This is a pre-existing cosmetic issue in the confirmation message, not a folder-resolution defect, and unrelated to the #132 ambiguity fix.
**PASS** (functional outcome correct; message-text defect noted above and in Unexpected findings).

**TC4** — `batch_add_items` with `SMOKE-TC4-ambiguous` (`folderName: "SMOKE-dup"`) and `SMOKE-TC4-ok` (`folderName: "SMOKE-parent"`)
Output:
```
✅ Successfully added 1 items. ⚠️ Failed to add 1 items.

- ❌ item: "SMOKE-TC4-ambiguous" - Error: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.
- ✅ project: "SMOKE-TC4-ok" (id: <id>)
```
Verification: `get_project_by_id {"projectName":"SMOKE-TC4-ambiguous"}` returned `Failed to retrieve project: Project not found` — the failed item was not created anywhere.
**PASS.**

**TC5** — `edit_item {"itemType":"project","id":"<SMOKE-TC2 id>","newFolderName":"SMOKE-dup"}`
Output: `Failed to update project: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.`
Verification: `get_folder_by_id {"folderName":"SMOKE-dup"}` still reported the same 2-way ambiguity (no third folder). `list_projects` on the nested folder id still showed SMOKE-TC2 in place.
**PASS.**

**TC6** — `batch_edit_items {"edits":[{"itemType":"project","id":"<SMOKE-TC2 id>","newFolderName":"SMOKE-dup"}]}`
Output: `Failed to process batch edit: undefined`
Verification: `get_folder_by_id {"folderName":"SMOKE-dup"}` still reported the same 2-way ambiguity (no third folder created); SMOKE-TC2 was still in the nested folder afterwards. The fail-closed behaviour (no silent folder creation, no silent move) held.
However, the error text delivered to the caller does **not** name the candidates, unlike every other case. Root cause, read in `src/tools/primitives/batchEditItems.ts` and `src/tools/definitions/batchEditItems.ts`: the underlying OmniJS script (`batchEditItems.js`) computes `success: successCount > 0` for the whole batch and only ever sets a top-level `error` string when the whole batch throws or fails to parse — not when every individual edit fails with its own per-item error. The tool definition's handler only prints per-item detail (including the ambiguity message with candidate paths) on the `result.success === true` branch; when a batch has a single edit and that edit fails, `successCount` is `0`, so `result.success` is `false`, and the handler falls into the `else` branch, which prints only `result.error` — which is `undefined` here because the real error lives in the per-item `results` array that this branch never reads.
This is a pre-existing bug (confirmed via `git show bf18f9e`, the only #132 commit touching these two files, which added the ambiguity check itself but did not touch the success/error branching), not something introduced by this branch's fix. But it means this call site's delivery of the #132 diagnostic is incomplete: **the candidate-path message is lost only when every edit in the batch fails**; it is not lost in a mixed batch. Confirmed with an extra, read-only, fixtures-only probe (`batch_edit_items` with the same ambiguous edit alongside a second edit that succeeds): output was `✅ Batch edit complete: 1 succeeded, 1 failed` with the failed line showing the full ambiguity message naming both candidates.
**FAIL** (fail-closed behaviour is correct; the caller-facing message is not delivered on this call site when the batch is all-failure). Recommend filing as a follow-up issue against `batchEditItems.ts`'s success/error branching; out of scope for this fix and no source was changed to make this case pass. Tracked in #146.

**TC7** — `list_projects {"folderName":"SMOKE-dup","status":"all"}`
Output: `Error: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.`
**PASS.**

**TC8** — `get_folder_by_id {"folderName":"SMOKE-dup"}`
Output: `Failed to retrieve folder: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.`
Note: the top-level candidate's listed path is itself the plain name `"SMOKE-dup"` — the same string that is ambiguous. That means the top-level folder is addressable only by `folderId`; there is no unambiguous name-based path for it (unlike the nested one, which can always be reached via `"SMOKE-parent > SMOKE-dup"`).
**PASS.**

**TC9** — `list_projects {"folderName":"SMOKE-parent","status":"all"}`
Output:
```
# Projects in "SMOKE-parent"

Found 1 all project:

| Name | Status | Tasks | Next Review | Folder |
|------|--------|-------|-------------|--------|
| SMOKE-TC4-ok | Active | 0 | 9/19/2026 | SMOKE-parent |
```
Unique-name resolution is unchanged: no ambiguity error, correct project listed. Deliberately used a unique `SMOKE-*` folder name here (not a real folder) so the listing could not expose the user's real project names.
**PASS.**

**TC10** — `edit_item {"itemType":"project","id":"<SMOKE-TC2 id>","newFolderName":"SMOKE-brand-new"}`
Output: `✅ Project "SMOKE-TC2" updated successfully (moved to new folder).`
Verification: `get_folder_by_id {"folderName":"SMOKE-brand-new"}` confirmed the new folder was created and now holds 1 project. The not-found path (auto-create) is preserved and is not confused with the ambiguous path.
**PASS.**

**TC11** — `add_folder {"name":"SMOKE-child","parentFolderName":"SMOKE-dup"}`
Output: `Failed to create folder: Folder name "SMOKE-dup" is ambiguous - 2 folders match: "SMOKE-dup", "SMOKE-parent > SMOKE-dup". Use the full "Parent > Child" path, or pass folderId.`
Verification: `get_folder_by_id {"folderName":"SMOKE-child"}` returned `Failed to retrieve folder: Folder not found` — no folder was created.
**PASS.**

**TC12** — `list_projects {"folderId":"<nested SMOKE-dup id>","folderName":"SMOKE-dup","status":"all"}`
Output:
```
# Projects in "SMOKE-dup"

Found 1 all project:

| Name | Status | Tasks | Next Review | Folder |
|------|--------|-------|-------------|--------|
| SMOKE-TC3 | Active | 0 | 9/19/2026 | SMOKE-parent > SMOKE-dup |
```
The call succeeded even though `folderName` was the ambiguous plain name, because `folderId` was supplied and takes priority — the ambiguous name is never consulted. (Only SMOKE-TC3 is listed because SMOKE-TC2 had already been moved out to `SMOKE-brand-new` by TC10.)
**PASS.**

### Summary

11 of 12 cases PASS. TC6 FAILs on message delivery only (candidate-path text lost when a `batch_edit_items` call's every edit fails); the underlying fail-closed behaviour it exists to verify held in every case, including TC6. No case required a change to reviewed source, and no source was changed to force a pass.

### Unexpected findings

1. **TC3 message-text anomaly.** The `add_project` success message reported
   "created successfully at the root level" even though the project was
   correctly filed in the nested folder — confirmed independently via
   `list_projects` and `get_project_by_id`. This is a pre-existing cosmetic
   bug in the confirmation-message text when a project is created directly
   by `folderId`, unrelated to the #132 ambiguity fix.
2. **TC6 message-delivery gap.** When every item in a `batch_edit_items` call
   fails, the tool prints `Failed to process batch edit: undefined` and drops the
   per-item ambiguity message naming the candidates. The fail-closed behaviour
   still held — no folder was created and no move occurred. This is pre-existing,
   not introduced by the #132 fix. It was confirmed by reading the source to be
   systemic across all three batch tools: the OmniJS scripts return `success:
   successCount > 0` with no top-level `error` when every item fails
   (`batchAddItems.js:360`, `batchEditItems.js:425`, `batchRemoveItems.js:172`),
   and the TypeScript handlers render per-item details only when `success` is
   `true` (`src/tools/definitions/batchAddItems.ts:43/83`,
   `batchEditItems.ts:71/99`, `batchRemoveItems.ts:35/65`). So a
   `batch_add_items` or `batch_edit_items` call whose only item names an
   ambiguous folder fails closed but hides the candidate list, while mixed
   batches show it correctly. This is tracked for a maintainer decision, not
   fixed in this change. Tracked in #146.
3. **TC10 timing.** The call took about 50 seconds end to end. It was
   slow, not a hang, so a future re-runner shouldn't abort it early.

### Cleanup

All fixtures created during this run were removed:

- `remove_item` for the SMOKE-TC2, SMOKE-TC3 and SMOKE-TC4-ok projects: all three returned success. No other unexpected `SMOKE-TC*` project was ever created (confirmed above for the two ambiguous-item cases).
- Guarded one-off OmniJS delete (refuses unless the id resolves, the name matches exactly, the name starts with `SMOKE-`, and the folder holds no projects and no subfolders), run in this order: `SMOKE-brand-new`, the nested `SMOKE-dup`, `SMOKE-parent`, the top-level `SMOKE-dup`. All four returned `{"ok":true,...}`.
- Final verification: `get_folder_by_id` for `SMOKE-dup`, `SMOKE-parent`, `SMOKE-brand-new` and `SMOKE-child` each again returned `Folder not found`. All fixtures fully removed.
- `smoke-142.mjs` deleted from the worktree root.
