// Shared utilities for OmniJS scripts
// These functions are prepended to OmniJS scripts at execution time

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
 * @param {Folder} folder - An OmniFocus Folder object
 * @returns {string} - Full path with " > " separators
 */
function getFolderPath(folder) {
  // In OmniJS, folder.parent is falsy for root-level folders (verified via
  // osascript testing), so the loop naturally stops without hitting Database.
  try {
    const parts = [];
    let current = folder;
    while (current) {
      parts.unshift(current.name);
      current = current.parent || null;
    }
    return parts.join(' > ');
  } catch (e) {
    // Fall back to bare name if the parent chain is inaccessible (e.g. during sync)
    return folder.name;
  }
}

/**
 * Resolve a folder by name, supporting path-style disambiguation.
 * Accepts plain names ("Projects") or paths ("Work > Projects").
 * Plain names match any folder (first match). Paths match the full ancestor chain.
 * Case-insensitive comparison.
 * @param {string} folderName - Folder name or " > "-separated path
 * @param {Array} allFolders - flattenedFolders array
 * @param {Map} [foldersByName] - Optional lowercased-name -> Folder index (first-wins)
 *   for O(1) plain-name resolution. When supplied it is consulted for the plain-name
 *   branch instead of scanning allFolders; the path-style branch always uses allFolders.
 *   The map must be built first-wins over the same folder set as allFolders so results
 *   are identical to the linear scan (see batch scripts' getFoldersByName()).
 * @returns {Folder|null} - Matched folder or null
 */
function resolveFolderByName(folderName, allFolders, foldersByName) {
  const nameLower = folderName.toLowerCase();
  const isPath = nameLower.indexOf(' > ') !== -1;

  if (isPath) {
    const pathLower = nameLower.split(' > ').map(function(s) { return s.trim(); });
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
      if (match) return folder;
    }
    return null;
  }

  // Plain name: first case-insensitive match (existing behavior).
  // When a name index is supplied, use its O(1) lookup; the index is built
  // first-wins so it returns the same folder the linear scan would.
  if (foldersByName) {
    return foldersByName.get(nameLower) || null;
  }
  for (const folder of allFolders) {
    if (folder.name.toLowerCase() === nameLower) {
      return folder;
    }
  }
  return null;
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
