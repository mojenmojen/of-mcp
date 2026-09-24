/**
 * Retry policy for OmniFocus script execution (issue #154).
 *
 * A timeout is not a failure. EXEC_OPTIONS kills the osascript subprocess after
 * 30 seconds, but that only severs our view of the work: the OmniJS script is
 * already running inside OmniFocus and carries on to completion. When OmniFocus
 * is merely slow, every retry therefore lands as another write. One add_folder
 * call produced four identical folders, which is 1 attempt + MAX_RETRIES.
 *
 * So a timeout may only be retried for a script that is safe to repeat. Every
 * other retry is unchanged: if OmniFocus is not running, for instance, the
 * script never ran at all, and repeating it cannot duplicate anything.
 *
 * This module is deliberately free of node imports so it can be bundled and
 * unit-tested on its own.
 */

import type { StructuredError } from './errors.js';

/** One initial attempt plus this many retries. */
export const MAX_RETRIES = 3;

/**
 * The OmniJS scripts that are safe to run again after a timeout.
 *
 * Anything not listed here is treated as unsafe, so a script added later loses
 * timeout retries until someone classifies it. That is the harmless direction to
 * fail; the other direction duplicates a user's data.
 *
 * Absent by design, because they write: addFolder, addProject, addTask,
 * batchAddItems, batchEditItems, batchMarkReviewed, batchRemoveItems,
 * duplicateProject, editItem, editTag, removeTask.
 *
 * Also absent: getCustomPerspectiveTasks. It only reads tasks, but with
 * ignoreFocus it sets document.focus to null and restores it at the end, so a
 * run killed mid-flight leaves Focus cleared and a retry would read that cleared
 * state as the original and restore the wrong thing.
 *
 * tests/retryPolicy.test.mjs pins this list against the files on disk, so a new
 * script cannot be left unclassified and a rename cannot leave a phantom entry.
 */
export const RETRY_SAFE_SCRIPTS: ReadonlySet<string> = new Set([
  'batchFilterTasks.js',
  'completionStats.js',
  'diagnoseConnection.js',
  'filterTasks.js',
  'flaggedTasks.js',
  'forecastTasks.js',
  'getChecksum.js',
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
 * Is this script safe to run again after a timeout?
 *
 * Accepts the '@name.js' form used by callers, a bare filename, or an absolute
 * path; all three are compared on the filename alone.
 */
export function isRetrySafeScript(scriptPath: string): boolean {
  const withoutPrefix = scriptPath.startsWith('@') ? scriptPath.substring(1) : scriptPath;
  const fileName = withoutPrefix.split('/').pop() ?? withoutPrefix;
  return RETRY_SAFE_SCRIPTS.has(fileName);
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
