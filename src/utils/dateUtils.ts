/**
 * Date formatting utilities with safe handling of invalid dates
 */

/**
 * Safely formats a date string to locale date string.
 * Returns null for invalid, null, or undefined date inputs.
 *
 * @param dateString - ISO date string, or null/undefined
 * @returns Formatted date string or null if invalid
 */
export function formatDateSafe(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString();
}
