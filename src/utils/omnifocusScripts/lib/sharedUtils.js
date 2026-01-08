// Shared utilities for OmniJS scripts
// These functions are prepended to OmniJS scripts at execution time

/**
 * Parse date strings as local time.
 * Fixes issue where "2026-02-04" would be interpreted as midnight UTC.
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
