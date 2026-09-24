/**
 * Retry policy for OmniFocus script execution (issue #154).
 *
 * A timeout is not a failure. EXEC_OPTIONS kills the osascript subprocess after
 * 30 seconds, but that only severs our view of the work: the OmniJS script is
 * already running inside OmniFocus and carries on to completion. When OmniFocus
 * is merely slow, every retry therefore lands as another write. One add_folder
 * call produced four identical folders, which is 1 attempt + MAX_RETRIES.
 *
 * Two separate questions decide what happens after a timeout, and they are not
 * the same question:
 *
 *   1. May this script be run again?   -> isRetrySafeScript()
 *   2. Could it have changed anything?  -> mayHaveWritten()
 *
 * Most reads answer no to (2) and yes to (1), but not all: a read that is
 * unsafe to repeat still must not be described to the user as a change that may
 * have landed. Collapsing the two is how get_custom_perspective_tasks came to
 * warn about creating a duplicate it could never create.
 *
 * This module is deliberately free of node imports so it can be bundled and
 * unit-tested on its own.
 */

import { createWriteTimeoutError, type StructuredError } from './errors.js';

/** One initial attempt plus this many retries. */
export const MAX_RETRIES = 3;

/**
 * The OmniJS scripts that only read. Nothing here can have changed the
 * database, whatever else happened to the attempt.
 */
export const READ_SCRIPTS: ReadonlySet<string> = new Set([
  'batchFilterTasks.js',
  'completionStats.js',
  'diagnoseConnection.js',
  'filterTasks.js',
  'flaggedTasks.js',
  'forecastTasks.js',
  'getChecksum.js',
  'getCustomPerspectiveTasks.js',
  'getFolderByName.js',
  'getProjectByName.js',
  'getProjectsForReview.js',
  'getTaskByIdOrName.js',
  'inboxTasks.js',
  'listCustomPerspectives.js',
  'listProjects.js',
  'listTags.js',
  'searchTasks.js',
  'systemHealth.js',
  'tasksByTag.js',
  'todayCompletedTasks.js'
]);

/**
 * The OmniJS scripts that change the database. Running one of these a second
 * time after a timeout is what produced four folders from one add_folder call.
 */
export const WRITE_SCRIPTS: ReadonlySet<string> = new Set([
  'addFolder.js',
  'addProject.js',
  'addTask.js',
  'batchAddItems.js',
  'batchEditItems.js',
  'batchMarkReviewed.js',
  'batchRemoveItems.js',
  'duplicateProject.js',
  'editItem.js',
  'editTag.js',
  'removeTask.js'
]);

/**
 * Reads that still must not be repeated after a timeout.
 *
 * getCustomPerspectiveTasks: with ignoreFocus it sets document.focus to null
 * and restores it at the end, so a run killed mid-flight leaves Focus cleared
 * and a retry would read that cleared state as the original and restore the
 * wrong thing.
 *
 * diagnoseConnection: retrying it is harmless, but pointless and actively
 * unhelpful. It exists to explain why OmniFocus is not responding, and a
 * wedged OmniFocus makes the full ladder run 30 + 1 + 30 + 2 + 30 + 4 + 30
 * seconds, past the two minutes a client typically waits. Repeating a
 * diagnostic tells the user nothing that waiting would not.
 */
const NOT_REPEATABLE_READS: ReadonlySet<string> = new Set([
  'diagnoseConnection.js',
  'getCustomPerspectiveTasks.js'
]);

/**
 * The scripts that may be run again after a timeout.
 *
 * Derived rather than hand-listed, so the reasons above stay next to the
 * exceptions they justify. tests/retryPolicy.test.mjs pins READ_SCRIPTS and
 * WRITE_SCRIPTS against the files on disk, so a new script cannot be left
 * unclassified and a rename cannot leave a phantom entry.
 */
export const RETRY_SAFE_SCRIPTS: ReadonlySet<string> = new Set(
  [...READ_SCRIPTS].filter(name => !NOT_REPEATABLE_READS.has(name))
);

/**
 * The filename a caller's script path refers to.
 *
 * Accepts the '@name.js' form used by callers, a bare filename, or an absolute
 * path.
 */
function scriptFileName(scriptPath: string): string {
  const withoutPrefix = scriptPath.startsWith('@') ? scriptPath.substring(1) : scriptPath;
  return withoutPrefix.split('/').pop() ?? withoutPrefix;
}

/**
 * May this script be run again after a timeout?
 *
 * An unclassified script is treated as unsafe, so a script added later loses
 * timeout retries until someone classifies it. That is the harmless direction
 * to fail; the other direction duplicates a user's data.
 */
export function isRetrySafeScript(scriptPath: string): boolean {
  return RETRY_SAFE_SCRIPTS.has(scriptFileName(scriptPath));
}

/**
 * Could this script have changed something before we stopped waiting?
 *
 * An unclassified script is assumed to have written, so the warning is shown
 * rather than withheld. Only a script known to be a read is treated as safe.
 */
export function mayHaveWritten(scriptPath: string): boolean {
  return !READ_SCRIPTS.has(scriptFileName(scriptPath));
}

/**
 * Should this failed attempt be retried?
 *
 * The timeout clause is the fix for #154; the rest is the original policy.
 */
export function shouldRetry(
  error: StructuredError,
  attempt: number,
  scriptPath: string
): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (!error.error.retryable) return false;
  if (error.error.type === 'timeout' && !isRetrySafeScript(scriptPath)) return false;
  return true;
}

/**
 * The error to report once retrying has been ruled out.
 *
 * A script that may have written something can have completed inside OmniFocus
 * after we stopped waiting, so say so rather than report a clean failure the
 * caller will answer by running it again. Everything else is returned
 * unchanged.
 */
export function finalizeTimeoutError(
  error: StructuredError,
  scriptPath: string
): StructuredError {
  if (error.error.type !== 'timeout') return error;
  if (!mayHaveWritten(scriptPath)) return error;
  return createWriteTimeoutError(error.error.details);
}
