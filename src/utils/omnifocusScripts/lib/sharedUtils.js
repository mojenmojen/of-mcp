// Shared utilities for OmniJS scripts
// Inserted at the top of each script's IIFE at execution time, after the
// injected parameters (see executeOmniFocusScript in src/utils/scriptExecution.ts)

/**
 * Parse date strings as local time.
 * Fixes issue where "2026-02-04" would be interpreted as midnight UTC.
 *
 * Twin of the hardened TypeScript `parseLocalDate()` in `src/utils/dateUtils.ts`.
 * This OmniJS copy is intentionally separate (it is prepended into the OmniFocus
 * runtime and is not importable from TS). Unlike the TS version it does NOT reject
 * well-shaped-but-invalid dates (e.g. "2026-13-45" rolls forward) and would throw
 * on null — #133 tracks hardening + testing this side. Keep the two in sync.
 *
 * @param {string} dateStr - Date string in ISO format (YYYY-MM-DD or full ISO)
 * @returns {Date} - Date object in local timezone
 */
function parseLocalDate(dateStr) {
  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10) - 1;
    const day = parseInt(dateOnlyMatch[3], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

/**
 * Build iCal RRULE string from repetition rule object.
 * Supports daily, weekly, monthly, and yearly frequencies with various options.
 * @param {Object} rule - Repetition rule configuration
 * @param {string} rule.frequency - 'daily', 'weekly', 'monthly', or 'yearly'
 * @param {number} [rule.interval] - Repeat every N periods (default: 1)
 * @param {number[]} [rule.daysOfWeek] - Days of week for weekly (0=Sun, 6=Sat)
 * @param {number} [rule.dayOfMonth] - Day of month for monthly (1-31)
 * @param {Object} [rule.weekdayOfMonth] - Weekday-of-month pattern for monthly
 * @param {number} rule.weekdayOfMonth.week - Week number (1-5 or -1 for last)
 * @param {number} rule.weekdayOfMonth.day - Day of week (0=Sun, 6=Sat)
 * @param {number} [rule.month] - Month for yearly (1-12)
 * @returns {string} - iCal RRULE string
 */
function buildRRule(rule) {
  let rrule = `FREQ=${rule.frequency.toUpperCase()}`;
  if (rule.interval && rule.interval > 1) {
    rrule += `;INTERVAL=${rule.interval}`;
  }
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = rule.daysOfWeek.map(d => dayMap[d]).join(',');
    rrule += `;BYDAY=${days}`;
  }
  if (rule.weekdayOfMonth) {
    // Weekday-of-month pattern: e.g., first Monday, last Friday
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayCode = dayMap[rule.weekdayOfMonth.day];
    rrule += `;BYDAY=${dayCode};BYSETPOS=${rule.weekdayOfMonth.week}`;
  } else if (rule.dayOfMonth) {
    rrule += `;BYMONTHDAY=${rule.dayOfMonth}`;
  }
  if (rule.month) {
    rrule += `;BYMONTH=${rule.month}`;
  }
  return rrule;
}

/**
 * Format a Date object to ISO string, safely handling null/undefined.
 * @param {Date|null|undefined} date - The date to format
 * @returns {string|null} - ISO string or null if date is falsy
 */
function formatDate(date) {
  if (!date) return null;
  return date.toISOString();
}

/**
 * Build a local YYYY-MM-DD date key from a Date.
 * Uses local year/month/date components — toISOString() would convert to UTC,
 * shifting the day for UTC+ users (see #114, #118).
 * @param {Date|null|undefined} date - The date to format
 * @returns {string|null} - Local date key (YYYY-MM-DD) or null if date is falsy
 */
function toLocalDateKey(date) {
  if (!date) return null;
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Build the full ancestor path for a folder (e.g. "Work > Projects > Active").
 * Walks up the parent chain. Returns the folder's own name if it has no parent.
 * Throws if the chain can't be read, rather than returning the bare name: a
 * bare name makes a nested folder look top-level, so resolveFolderRef would
 * skip it without a trace. Callers that only display a path (listProjects.js,
 * getFolderByName.js) catch the error themselves.
 * @param {Folder} folder - An OmniFocus Folder object
 * @returns {string} - Full path with " > " separators
 */
function getFolderPath(folder) {
  // In OmniJS, folder.parent is falsy for root-level folders (verified via
  // osascript testing), so the loop naturally stops without hitting Database.
  const parts = [];
  let current = folder;
  while (current) {
    parts.unshift(current.name);
    current = current.parent || null;
  }
  return parts.join(' > ');
}

/**
 * Resolve a folder by plain name or " > "-separated path.
 * Case-insensitive. Only " > " with spaces separates segments; path segments
 * are trimmed, plain names are not, and a folder whose own name contains
 * " > " can't be matched by name (see #147). A path must match the folder's
 * whole chain from the top level: "Clients > Archive" does not match a folder
 * whose full path is "Work > Clients > Archive".
 * Collects every match so callers can fail closed on ambiguity rather than
 * silently taking the first (issue #132; the folder side of #112).
 * A path lookup reads the parent chain of every folder whose name matches the
 * last segment, and throws if one can't be read: skipping that folder could
 * hide a second match, or leave no match and send an edit tool to
 * create-on-miss.
 * @param {string} folderName - Folder name or " > "-separated path
 * @param {Array} allFolders - flattenedFolders array
 * @returns {{folder: Folder|null, matches: Array, ambiguous: boolean}}
 *   matches holds every matching folder (empty when none match); folder is
 *   set only when exactly one matches; ambiguous is true when two or more do.
 */
function resolveFolderRef(folderName, allFolders) {
  const nameLower = folderName.toLowerCase();
  const isPath = nameLower.indexOf(' > ') !== -1;
  const matches = [];

  if (isPath) {
    const pathLower = nameLower.split(' > ').map(function (s) { return s.trim(); });
    const leafName = pathLower[pathLower.length - 1];
    for (const folder of allFolders) {
      if (folder.name.toLowerCase() !== leafName) continue;
      // Walk up the parent chain and compare each segment
      const actualPath = getFolderPath(folder).toLowerCase().split(' > ');
      if (actualPath.length !== pathLower.length) continue;
      let match = true;
      for (let i = 0; i < pathLower.length; i++) {
        if (actualPath[i] !== pathLower[i]) { match = false; break; }
      }
      if (match) matches.push(folder);
    }
  } else {
    for (const folder of allFolders) {
      if (folder.name.toLowerCase() === nameLower) {
        matches.push(folder);
      }
    }
  }

  if (matches.length === 1) {
    return { folder: matches[0], matches: matches, ambiguous: false };
  }
  if (matches.length === 0) {
    return { folder: null, matches: [], ambiguous: false };
  }
  return { folder: null, matches: matches, ambiguous: true };
}

/**
 * Note a folder's dropped state for the ambiguity error: ", dropped" when the
 * folder itself is dropped, ", inside a dropped folder" when an ancestor is,
 * and "" when it is active. A project filed into either kind is effectively
 * dropped too, which is how #112 hid projects. The ancestor walk mirrors
 * isInDroppedFolder in listProjects.js.
 * @param {Folder} folder - An OmniFocus Folder object
 * @returns {string}
 */
function folderStateNote(folder) {
  // Read outside the try: a missing Folder global is a programming error and
  // must fail loudly. Only the folder's own reads below may fall back.
  const dropped = Folder.Status.Dropped;
  try {
    let current = folder;
    let isSelf = true;
    while (current) {
      if (current.status === dropped) {
        return isSelf ? ', dropped' : ', inside a dropped folder';
      }
      current = current.parent;
      isSelf = false;
    }
  } catch (e) {
    // The note is advice inside an error that is already being returned. If
    // a status or parent can't be read, print the candidate without a note
    // rather than lose the message.
  }
  return '';
}

/**
 * Build the user-facing error for an ambiguous folder name.
 * Kept here so every call site builds the one message. Lists each
 * candidate's full path and folderId, so a candidate that path syntax can't
 * select can still be chosen by ID: a top-level folder that shares its name
 * with a nested one, or either of two folders with the same full path.
 * After the ID a candidate may carry notes: "full path unreadable" when its
 * parent chain can't be read (its own name is shown instead of the path),
 * then "dropped" or "inside a dropped folder" from folderStateNote.
 * @param {string} folderName - The name the caller passed
 * @param {Array} matches - Folders that matched (length >= 2)
 * @param {string} idParam - The calling tool's folder-ID parameter, named in
 *   the advice: 'folderId', 'newFolderId' or 'parentFolderId'. Required: the
 *   MCP SDK drops unknown arguments, so naming the wrong one would be ignored.
 * @returns {string}
 */
function formatAmbiguousFolderError(folderName, matches, idParam) {
  const candidates = matches.map(function (f) {
    let path;
    let note = '';
    try {
      path = getFolderPath(f);
    } catch (e) {
      // resolveFolderRef's plain-name branch never reads the chain, so an
      // unreadable candidate can reach here. Its ID still identifies it.
      path = f.name;
      note = ', full path unreadable';
    }
    return '"' + path + '" (id: ' + f.id.primaryKey + note + folderStateNote(f) + ')';
  }).join(', ');
  return 'Folder name "' + folderName + '" is ambiguous - ' + matches.length +
    ' folders match: ' + candidates +
    '. Use the full "Parent > Child" path, or pass ' + idParam + '.';
}

/**
 * Map of OmniFocus Task.Status enum values to human-readable strings.
 * Used for serializing task status in JSON responses.
 */
const taskStatusMap = {
  [Task.Status.Available]: "Available",
  [Task.Status.Blocked]: "Blocked",
  [Task.Status.Completed]: "Completed",
  [Task.Status.Dropped]: "Dropped",
  [Task.Status.DueSoon]: "DueSoon",
  [Task.Status.Next]: "Next",
  [Task.Status.Overdue]: "Overdue"
};
