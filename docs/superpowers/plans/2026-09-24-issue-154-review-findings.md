# PR #155 — review findings and action plan

Date: 2026-09-24
Branch: `worktree-fix-154-retry-writes`, at `52dfbfd`
PR: https://github.com/mojenmojen/of-mcp/pull/155 (open, mergeable)

Two rounds of agent review. Round one was a single general reviewer; round two ran
five specialists through `pr-review-toolkit:review-pr` (code quality, tests, silent
failures, comments, type design).

**Verdict was unanimous: merge.** Four said merge or ship outright, the comment
reviewer said approve-with-changes. No reviewer found a correctness defect in the
shipped retry behaviour. All five independently confirmed the classification is
right: 31 scripts, 20 reads + 11 writes, no overlap, no phantoms, suite green at
91 tests.

MoJen's decision: **do Tier 1 and Tier 2 in this PR, file Tier 3 as one follow-up
issue.**

---

## Status: Tier 1 and Tier 2 are done (2026-09-24)

All eleven Tier 1 findings and all three Tier 2 findings are fixed on this branch.
Suite went 91 -> 103 tests, `tsc --noEmit` exit 0, `build:fast` clean. Tier 3 is filed
as one follow-up issue; nothing from Tier 3 was changed here.

Three of the fixes were verified by deliberately breaking the code and watching the new
test catch it, then restoring:

- 1.8: misspelling an entry in `NOT_REPEATABLE_READS` is now a `tsc` error
  (`TS2769`), where before it was a silent no-op.
- 1.10: stubbing `categorizeError`'s timeout predicate to `if (false)` failed exactly
  one test -- the new one. Under the old suite all 91 passed with that branch dead.
- 2.1: hard-coding `dispatched = true` failed the new wiring guard in
  `tests/scriptExecution.test.mjs`.

Two corrections to this document, found while doing the work:

- **1.7's replacement numbers were wrong too.** "46 files use the `String(error)`
  fallback, 29 use `'Unknown error'`, 62 distinct files" is not reproducible on this
  tree. Counted directly: 54 sites use `: String(error)` and 13 use
  `: 'Unknown error'` -- **67 unwrap sites across 45 files**; 61 files in `src/` do
  some form of `instanceof Error ?` unwrap. The docs now carry those figures and say
  what they count.
- **2.1 needed a second error factory.** `createWriteTimeoutError`'s message names a
  30-second timeout, which is false for a post-dispatch JSON-parse failure. A timeout
  keeps `TIMEOUT_WRITE_UNVERIFIED`; any other post-dispatch failure of a write gets the
  new `WRITE_UNVERIFIED`, which keeps the original message and type and appends the
  caveat and the three lines of advice.

One judgement call for MoJen: **the version stays at 2.1.0.** These are corrections to
an unreleased change in the same PR, so bumping would imply 2.1.0 shipped. The build
stamp from #126 (commit SHA + `buildStale`) already distinguishes the two builds, which
is what the CLAUDE.md bump rule exists to serve. Say the word and it becomes 2.1.1.

Round one's three Important findings were already fixed in `52dfbfd` and are not
repeated here; see the "Review findings addressed" section of
`2026-09-24-issue-154-plan.md`.

---

## Tier 1 — defects in what this PR claims or introduces

All small. Every one is something the change itself got wrong.

### 1.1 The `getCustomPerspectiveTasks` justification is factually wrong

`src/utils/retryPolicy.ts` (the `NOT_REPEATABLE_READS` comment), repeated in
`tests/retryPolicy.test.mjs` (the "a read that cannot be repeated" test),
`docs/superpowers/plans/2026-09-24-issue-154-plan.md`, and softened in
`docs/WHATS_NEW.md`.

The comment says a retry "would read that cleared state as the original and restore
the wrong thing." Traced through `src/utils/omnifocusScripts/getCustomPerspectiveTasks.js`,
that cannot happen. On a retry `originalFocus = document.focus` is `null`, so
`focusWasActive` is `false`, the clearing branch is skipped, `focusCleared` stays
`false`, and the `finally` guard `if (focusCleared && originalFocus)` is skipped
too. The retry restores **nothing**.

The real harms: Focus stays cleared permanently, and the response reports
`focus: {wasActive: false, cleared: false, target: null}` — telling the caller no
Focus was ever set when one was.

Fix the reason in all four places. Suggested wording: "a run OmniFocus never
finishes leaves Focus cleared; a retry then reads `null` as the original, so it
neither re-clears nor restores, and reports `wasActive: false` for a window that did
have a Focus. The Focus is lost and the caller is told it never existed."

### 1.2 That comment contradicts the module header

`src/utils/retryPolicy.ts`, header versus the `NOT_REPEATABLE_READS` comment.

The header says killing `osascript` "only severs our view of the work: the OmniJS
script is already running inside OmniFocus and **carries on to completion**." The
exception comment says a run is "killed mid-flight". Both cannot be true — if the
script carries on, its `finally` restores Focus and there is nothing to worry about.

The exclusion is only justified where OmniFocus is wedged badly enough that the
script never finishes, which is the same condition `diagnoseConnection` is excluded
for. Say that explicitly. (A second defensible reason: a retry racing the first run,
both mutating shared window state.)

Two independent reviewers raised this. It is the clearest must-fix in the PR,
because the PR's own thesis is that these reasons are what stop the bug returning —
a reason that does not survive being checked invites confident removal.

### 1.3 `createWriteTimeoutError`'s comment cites an unreachable case

`src/utils/errors.ts`, echoed in `tests/errors.test.mjs`.

It says the type stays `'timeout'` "so that type-based matching, such as
**diagnose_connection's**, keeps working". There are exactly three consumers of
`error.error.type`: `diagnoseConnection.ts`, and `shouldRetry` / `finalizeTimeoutError`
in `retryPolicy.ts`. `diagnose_connection` only ever catches errors from
`@diagnoseConnection.js`, which is a read, so `finalizeTimeoutError` returns the plain
timeout and it can never see `TIMEOUT_WRITE_UNVERIFIED`.

Keep the decision, fix the reason: name `shouldRetry` and `finalizeTimeoutError` as
the actual type-matchers, with `diagnose_connection` as the hypothetical.

### 1.4 `CLAUDE.md` never mentions `NOT_REPEATABLE_READS`

The instruction reads "Add every new OmniJS script to `READ_SCRIPTS` or
`WRITE_SCRIPTS`." A future assistant adding a read that toggles window state, or one
that exists to explain a wedged OmniFocus, would follow it exactly, put the script in
`READ_SCRIPTS`, and silently make it retry-safe — recreating the `diagnoseConnection`
bug this PR just fixed.

Add a clause: a read that must not be repeated — because it mutates app state, or
because repeating it defeats its purpose — also goes in `NOT_REPEATABLE_READS`, with
its reason.

### 1.5 `CLAUDE.md` overstates what the content test guarantees

It says the suite fails "if anything in the retry-safe set contains a mutation call."
The regex is a fixed alternation of ten patterns, and the test's own comment concedes
`editTag.js` writes purely by property assignment and matches nothing. A future read
script doing `task.flagged = true` sails through.

Say it is a heuristic that catches constructor and method mutations, and that
property-assignment writes are not detected, so classify deliberately.

### 1.6 `docs/WHATS_NEW.md` overstatements

- "a script added later can never silently duplicate a user's data" — true for
  timeouts only. An `app_unavailable` retry of an unclassified write still repeats,
  which the next paragraph explains is deliberate. Add "on a timeout".
- "It now answers once, promptly" — on a wedged OmniFocus `diagnose_connection` still
  waits the full 30 seconds. Say "after a single 30-second wait rather than about two
  minutes".
- **"`diagnose_connection` can give its specific advice again" is only true for the
  timeout branch.** See finding 2.2 — permission and not-running never reach the code
  this PR changed. Correct this when 2.2 is fixed, or state the limit.
- "when given `ignoreFocus`" reads as opt-in; it defaults to `true`. The real
  condition is `ignoreFocus && focusWasActive`.

### 1.7 The handler count is wrong

Plan and PR body say "43 + 29 = 72 handlers". Issue #152 itself notes some files use
both idioms, so that double-counts. Verified on this tree: 46 files use the
`String(error)` fallback, 29 use `'Unknown error'`, **62 distinct files**. The
`tests/errors.test.mjs` header says "~72" and should say "~60" or drop the number.

### 1.8 Type `NOT_REPEATABLE_READS` against the read list

`src/utils/retryPolicy.ts`. It is `ReadonlySet<string>`, so a typo in a future entry
(`'getCustomPerspectivesTasks.js'`) is a **silent no-op**: the filter would not remove
the real script, and `getCustomPerspectiveTasks` would quietly become retry-safe
again. The existing tests pin today's two entries by name, so a third entry added
later is unguarded.

Verified to compile by the type-design reviewer:

```ts
const READ_SCRIPT_NAMES = ['batchFilterTasks.js', /* … */] as const;
type ReadScript = typeof READ_SCRIPT_NAMES[number];
export const READ_SCRIPTS: ReadonlySet<string> = new Set(READ_SCRIPT_NAMES);
const NOT_REPEATABLE_READS: ReadonlySet<ReadScript> = new Set<ReadScript>([...]);
export const RETRY_SAFE_SCRIPTS: ReadonlySet<string> = new Set(
  READ_SCRIPT_NAMES.filter(n => !NOT_REPEATABLE_READS.has(n))
);
```

**The exported sets must stay `ReadonlySet<string>`.** Narrowing them breaks
`READ_SCRIPTS.has(scriptFileName(path))`, because `has` is checked contravariantly at
the call. Only the private set is narrowed.

### 1.9 The last bare-object throw

`src/tools/primitives/batchAddItems.ts:136` still does `throw createValidationError(...)`.
It is caught by that function's own `catch`, which checks `isStructuredError` first,
so no user sees `[object Object]` from it — but it is the only place left in `src/`
where "everything thrown is an `Error`" does not hold. One line:
`throw new OmniFocusError(createValidationError(...))`.

### 1.10 `categorizeError`'s timeout branch has zero coverage

`src/utils/errors.ts`. Nothing becomes `type: 'timeout'` any other way, and every
existing test starts from a hand-built `createTimeoutError()`. If that predicate
broke, the error would categorise as `unknown`/non-retryable: no duplicate (fails
safe), but `finalizeTimeoutError` passes it through and the user silently loses the
"may still have been applied" warning — the exact behaviour #154 exists to produce.
All 91 tests would still pass.

`categorizeError` is already exported from the bundled `dist/test-build/errors.mjs`,
so this needs no new build step. Verified working:

```js
const killed = Object.assign(new Error('Command failed: osascript ...'),
  { killed: true, signal: 'SIGTERM', stderr: '' });
assert.equal(categorizeError(killed).error.type, 'timeout');
```

Add the negative too: an exec failure that is not killed does not become a timeout.

### 1.11 Give the mutation detector a liveness check

`tests/retryPolicy.test.mjs`. Nothing asserts the regex still matches *anything*, so
if the pattern is edited or the OmniJS scripts are refactored to write through a
helper (`createFolder(...)` rather than `new Folder(`), the test passes forever while
checking nothing. Two lines: assert `RETRY_SAFE_SCRIPTS.size > 0`, and assert the
regex matches at least ~8 of `WRITE_SCRIPTS` (it matches 10 of 11 today; `editTag.js`
is the honest exception). Same guard for the `WRITE_SCRIPTS` loop.

---

## Tier 2 — closes the bug class rather than the instance

### 2.1 Key on dispatch, not on error type  (the important one)

`src/utils/retryPolicy.ts` `finalizeTimeoutError`, called from `src/utils/scriptExecution.ts`.

The PR's insight is that the OmniJS script is not cancelled when our side stops
waiting. That is true of **every** failure raised after `execAsync` is dispatched, not
only the SIGTERM one. `finalizeTimeoutError` gates on `type === 'timeout'`, so every
other post-dispatch failure is reported unchanged.

Reachable today: `osascript` exits 0 — meaning `evaluateJavascript()` returned and the
write has already completed inside OmniFocus — but `stdout` is empty or non-JSON (an
OmniJS path returning `undefined`, a stray line on stdout). `JSON.parse` throws, the
error categorises as `unknown`, and the user is told:

> `Failed to create folder: Failed to parse OmniFocus script output as JSON. Output preview:`

with `isError: true`. A clean-failure report for a folder that exists, and the natural
response is to run it again. #154's loop through a different door.

Fix: set `let dispatched = false` and flip it to `true` immediately before
`await execAsync(...)`. Replace `finalizeTimeoutError(structured, scriptPath)` with
something like `finalizeUnverifiedWrite(structured, scriptPath, dispatched)`, which
applies the "may still have been applied" wording to **any** error where
`dispatched && mayHaveWritten(scriptPath)`. Pre-dispatch failures (script not found,
`writeFileSync` failure) stay clean failures — which the current code gets right by
accident rather than by design.

**This also subsumes the `app_unavailable` residual** that three reviewers raised
separately: never retry a write once the exec call has been made, whatever the error
type. That is strictly stronger than gating on `timeout` and needs no per-type
reasoning. Update the test comment at "a write is still retried when OmniFocus is not
running" — the premise ("the script never ran") is a property of the situation, not of
the type, and `app_unavailable` is assigned by substring match on message + stderr.

Keep `finalizeTimeoutError`/its replacement pure and unit-tested; that is why round
one extracted it.

### 2.2 `diagnose_connection`'s permission and not-running branches are dead

`src/tools/primitives/diagnoseConnection.ts`, caused by the JXA wrapper in
`src/utils/scriptExecution.ts`.

The wrapper catches every Apple-event exception and returns
`JSON.stringify({ error: e.message })` on stdout. `Application('OmniFocus')` and
`includeStandardAdditions` send no Apple event; `app.evaluateJavascript()` is the first
that does. So a TCC denial (`-1743`) throws *inside* `run()`, is caught there, and
`osascript` exits **0** with `{"error":"Not authorized…"}` on stdout. `JSON.parse`
succeeds, no exception is thrown, `categorizeError` never runs.

`diagnose_connection` then lands in its `parsed.success === false` branch, which pushes
`Script error: …` and **no instructions at all** — worse than the generic advice #152
complained about. The tool built to say "open System Settings → Privacy & Security →
Automation" returns an empty instruction list, and reports `omnifocusRunning: false`
when OmniFocus is running. The new `permission_denied` and `app_unavailable` branches
are unreachable for the cases they name.

Why round one missed it: #152's observed failure was the *timeout*, where `execAsync`
genuinely rejects and the catch genuinely fires. That path is fixed; these two were
never exercised.

Fix (smaller option, keeps the wrapper's stdout contract): route the
`parsed.success === false` branch through `categorizeError(new Error(parsed.error))`
so the same classification and instructions apply whether the failure arrived as an
exception or as a payload. Either way that branch must not be able to return an empty
`instructions` array.

Not verified end-to-end — confirming it needs one manual run with automation
permission revoked.

### 2.3 Temp-file names collide under concurrency

`src/utils/scriptExecution.ts`, both `jxa_script_${Date.now()}.js` and
`jxa_wrapper_${Date.now()}.js`.

Millisecond resolution, no randomness, no PID. MCP servers handle requests
concurrently. Two calls in the same millisecond write the same path: B's
`writeFileSync` overwrites A's script between A's write and A's `osascript` read, so
**A executes B's script**. If B is `@batchRemoveItems.js`, A's `list_projects` call
silently performs a deletion and A's caller is told about projects. The `finally` then
unlinks a file the other call may still be reading.

Pre-existing, but it is an unsignalled wrong-write in the file this PR is about.
One line: `` `jxa_wrapper_${process.pid}_${randomUUID()}.js` `` (or `mkdtempSync`).

---

## Tier 3 — file as one follow-up issue, do not fix here

1. **Structured `instructions` are dropped by every tool handler.** `diagnose_connection`
   is the only consumer in `src/tools/` that reads them. So the write-timeout's two
   actionable lines ("NOT retried", "may create a duplicate") never reach the user, and
   the definition layer prefixes the message with `Failed to create folder:` — the first
   three words assert what the rest retracts. Wants a shared `formatToolError()` that
   appends `instructions` whenever present; that also fixes permission instructions being
   dropped everywhere else.
2. **`maxBuffer` overflow is indistinguishable from a timeout.** Node kills the child with
   SIGTERM and sets `killed: true` on overflow, so `categorizeError`'s first branch
   matches. Node distinguishes it via `error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'`.
   On a read this means a false "timed out after 30 seconds" plus three retries that each
   redo the expensive work; on a write it becomes `TIMEOUT_WRITE_UNVERIFIED` with the right
   safety conclusion for the wrong stated reason. An externally-sent SIGTERM is misread the
   same way.
3. **A timed-out `get_custom_perspective_tasks` can leave Focus cleared and says nothing.**
   The script reports restore failures via `focus.restoreError`, but on a timeout nothing
   is returned, so that channel is gone. `mayHaveWritten` is `false` for it, so the user
   gets the plain timeout advice. `document.focus = null` *is* a change that may have
   landed — the read/write split is the right axis for database duplication and the wrong
   one for "did this leave OmniFocus in a state the user didn't ask for". Note the mutation
   regex already classifies it as a mutation while `mayHaveWritten` does not. Wants a narrow
   third predicate or a per-script extra-instructions map.
4. **`diagnose_connection` has no tests at all** — four branches and a fallback, all
   unexercised. Wants the same treatment round one gave `finalizeTimeoutError`: extract the
   classify-and-advise part into a pure function over the caught error.
5. **No injection seam for `execAsync`**, so nothing exercises the retry loop itself.
   `tests/scriptExecution.test.mjs` uses a non-existent script name, which fails at the
   `existsSync` check and never reaches `shouldRetry`'s retry branch or the rewrite.
6. **`executeJXA` is outside the whole fix** — bare `new Error(...)`, no structured type,
   no retry policy, no write question. Its four callers in `perspectiveEngine.ts` are
   read-only, so no duplication risk today, but it is a second divergent error contract in
   the same file.
7. **Script identity is basename-only.** An absolute path ending in a read script's name
   inherits that script's retry-safety regardless of contents. No caller does this; consider
   restricting classification to `@`-prefixed names and treating absolute paths as
   unclassified, which already fails safe on both axes.
8. **"30 seconds" is hardcoded in four places** while `EXEC_OPTIONS.timeout` is the real
   source. Changing the timeout makes three user-facing messages lie.
9. **Narrow `StructuredError.error.code`** to `typeof ErrorCodes[keyof typeof ErrorCodes]`.
   Two lines, zero call-site churn, verified safe because `StructuredError` objects are
   constructed only inside `errors.ts`.
10. **`OmniFocusError`'s serialised shape** carries `name` and drops top-level `message`
    (Node sets `message` non-enumerable). Nothing consumes either. Worth one sentence in the
    class comment so nobody reaches for `JSON.parse(JSON.stringify(err)).message`.
11. **Empty catch in `getCustomPerspectiveTasks.js`** around the JSON re-serialisation: if
    it fails, the Focus restore failure is dropped entirely. Pre-existing, and in the exact
    script item 3 turns on.
12. **Stale line references** in the committed plan — correct against `b843759`, stale once
    this lands. Strip them or anchor each to the base commit.

---

## Explicitly rejected, with reasons — do not revisit

- **Branded or nominal `ScriptName` with a smart constructor.** The scripts are loose files
  loaded from disk at runtime; this needs validation at every call site and still cannot know
  the file exists. Ceremony for a guarantee the disk-pinned test already provides.
- **A `Record<ScriptName, 'read' | 'read-unrepeatable' | 'write'>` replacing the three sets.**
  Would make "classified as both" impossible by construction, but scatters the grouped doc
  comments, which are the thing most likely to prevent regression. Disjointness is already
  tested.
- **Collapsing `StructuredError` and `OmniFocusError`.** It typechecks, but it makes every
  factory result a stack-carrying `Error` used as plain data, serialises response payloads
  with a stray `name`, and invalidates the `[object Object]` premise test. Keep two
  representations; the rule is "only `OmniFocusError` is ever thrown" (see 1.9).
- **A `ScriptRef` template-literal type on `executeOmniFocusScript`.** Verified to work and
  it would make calling an unclassified script a compile error — but the disk-pinned test
  already fails the moment an unclassified `.js` file lands, before anyone can call it.
  Earlier feedback and a nicer message, not new coverage.
- **A `RetryDecision` discriminated union** merging `shouldRetry` and the finalise step. A
  genuine invariant-expression improvement, but it collapses two independently-testable
  functions into one for a six-line pairing in a single caller. Revisit only if a second
  caller appears.

---

## Verification for this round

```bash
cd /Users/mojen/dev/of-mcp/.claude/worktrees/fix-154-retry-writes
PATH="$HOME/.local/esbuild/node_modules/.bin:$PATH" npm test
ln -s /Users/mojen/dev/of-mcp/node_modules node_modules
/Users/mojen/dev/of-mcp/node_modules/.bin/tsc --noEmit    # then: rm node_modules
PATH="$HOME/.local/esbuild/node_modules/.bin:$PATH" npm run build:fast
```

Never a plain `npm install` — the committed lock pins TS 5.9.3, which hangs. The
installed tsc in the main checkout is 5.8.3 and checks this project clean in under a
second. The worktree has no `node_modules` of its own.

Baseline before this round: 91 tests passing, `tsc --noEmit` exit 0, PR mergeable.
