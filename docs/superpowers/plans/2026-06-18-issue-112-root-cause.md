# Issue #112 — Root Cause CONFIRMED (2026-06-18)

> **Sanitized 2026-09-12 before committing.** of-mcp is a public repository, so the
> reporter's real project and folder names, and their OmniFocus object IDs, have been
> replaced with placeholders. `<shared-name>` stands for the folder name both folders
> had. Nothing else about the findings has changed; corrections made since are marked.

**Environment:** Live reproduction on the reporter's Mac. Connected MCP server **v1.30.13**
(stale install; worktree is v1.33.0). OmniFocus on macOS darwin 25.3.0.

## Root cause (high confidence — git + behavioral proof)

There are **two folders named `<shared-name>`** in the reporter's database: one **Active**
and one **Dropped** (a distinct folder, nested one level under a different parent).

The **v1.30.13** `batchAddItems.js` resolves `folderName` via a **last-write-wins Map**:

```js
flattenedFolders.forEach(f => foldersByName.set(f.name.toLowerCase(), f)); // last dup wins
container = getFoldersByName().get(folderName.toLowerCase());              // returns LAST match
```

while `add_project` and the `folderId` path use **first-match** (and exact-id). So:

- `batch_add_items` + `folderName:"<shared-name>"` → lands the project in the **Dropped**
  folder → project shows **effective Dropped** (own status is Active; the drop is inherited
  from the parent folder via `getEffectiveStatus`, getProjectByName.js:61-82).
- `add_project` + `folderName:"<shared-name>"` → first-match → **Active** folder → Active.
- `folderId` → exact folder → Active.

This matches the issue's original table exactly, and explains the dev null-repro (their DB has
no dropped duplicate of that name).

### D2 (recovery "fails") is the same bug, not independent
`newProjectStatus:"active"` sets the project's **own** status (already Active) → no-op; the project
is still inside the Dropped folder → still shows Dropped. Only **moving it out** recovers it — which
is exactly what the reporter's real-world recovery did (new project + move tasks), and what the
move-to-sandbox experiment below proved.

## Live evidence (this session)

| Exp | Action | Result |
|-----|--------|--------|
| S1 | `batch_add_items` (proj + 8 tasks, `folderName` = a fresh sandbox folder) → snapshot | **Active** |
| S2 | + `edit_item newReviewInterval:7` → snapshot | Active |
| S3 | + `batch_edit_items` repetition rule on child → snapshot | Active |
| B  | Same batch shape, `folderName:"<shared-name>"` (real) → snapshot | **Dropped (born)** |
| C  | `add_project` `folderName:"<shared-name>"` → snapshot | **Active** |
| B-move | Move B from `<shared-name>` → sandbox (no status edit) | **flips to Active** |

S1-S3 prove: not born-Dropped and not flipped by edits — *in the sandbox folder*. B vs C prove
batch-vs-add_project diverge in the **same** folderName. B-move proves the drop is **folder-effective**,
not own-status.

## Falsifiable confirmation of the duplicate dropped folder (read-only)

`list_projects status:dropped` diff:
- `includeDroppedFolders:true`  → **34** dropped projects.
- `includeDroppedFolders:false` → **8** dropped projects.

The **26 that vanish are folder-trapped** (in a dropped folder), including archived projects and
the shells left by earlier repro attempts. Since the active `<shared-name>` folder is Active, a
project in it is NOT excluded by `includeDroppedFolders:false`; the trapped ones vanish, so they sit
in a **dropped folder also named `<shared-name>`** — the duplicate. The **8 that remain** are
genuinely own-dropped (test projects in the active folder, plus root-level test projects) —
consistent, because the `folderId` path targets the active folder correctly.

> **Correction (2026-09-12):** not all 26 were in the duplicate. Re-measured by filtering on the
> shared name (43 projects with dropped folders included, 33 without), **10** projects sat in the
> dropped duplicate; the rest of the 26 were trapped under other, unrelated dropped folders. The
> conclusion — a dropped folder sharing the name — is unaffected.

**Correction to the earlier read-only pass:** the archived projects and shells are NOT own-status
Dropped; they are folder-trapped in the dropped duplicate. One mechanism, not two.

## Git provenance
- Batch `resolveFolderByName` (first-match) adopted at `e18f452` = **v1.32.0**.
- v1.30.13 (`dcdd777`) batch still used the last-write-wins `foldersByName` Map.
- Current HEAD (v1.33.0) batch uses `resolveFolderByName` (first-match) — **no name Map**.

## Implication for the fix
The D1 *symptom* is likely already mitigated in v1.33.0 because batch now uses first-match
(same as add_project, which currently resolves to the Active `<shared-name>` folder). BUT:
1. First-match is **order-dependent / fragile** — it works only because the Active folder
   happens to come first in `flattenedFolders`. The real defect is **ambiguous duplicate folder
   names**, one of them Dropped.
2. **D2 is still broken in v1.33.0**: `newProjectStatus:"active"` still cannot recover a project
   that is effectively-Dropped because of a Dropped parent folder (the own-status verify-guard
   from the 2026-04-19 plan checks own status, which is already Active — it would not catch this).

## Resolution (2026-09-12)

- **Duplicate located and removed on the affected database.** The dropped duplicate was nested one
  level under a different parent folder. The reporter renamed it, and it was then verified that the
  plain name resolves only to the Active folder and that the archived projects are addressable
  under the new name.
- **Fix scope decided: fail closed.** A plain `folderName` matching more than one folder will return
  an error naming every candidate by full path. Planned in **#142**, which supersedes #132.
- **D2 split out** into its own issue, **#143**, since it is a status-handling defect rather than
  a name-resolution one.
- **Test artifacts:** the sandbox projects from these experiments had already been removed by
  2026-09-12. One empty, Active sandbox folder remains in the reporter's database for manual
  deletion; its details are kept in private notes rather than here.
