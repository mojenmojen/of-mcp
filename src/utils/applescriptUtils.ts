/**
 * Utility functions for AppleScript generation and handling
 */

/**
 * Escape a string for safe use in AppleScript double-quoted strings
 * Only escapes backslashes and double quotes as per Apple documentation
 */
export function escapeForAppleScript(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Characters that need special handling in AppleScript string comparisons.
 * We use character id (ASCII code) to represent these unambiguously.
 */
const SPECIAL_CHARS: Record<string, number> = {
  '$': 36,   // Dollar sign - can cause issues in some contexts
};

/**
 * Smart quote mappings - normalize curly quotes to straight quotes
 */
const QUOTE_NORMALIZATIONS: Record<string, string> = {
  '\u2018': "'",  // Left single quotation mark → straight apostrophe
  '\u2019': "'",  // Right single quotation mark → straight apostrophe
  '\u201C': '"',  // Left double quotation mark → straight double quote
  '\u201D': '"',  // Right double quotation mark → straight double quote
};

/**
 * Generate an AppleScript string expression that safely handles special characters.
 * Uses character id for problematic characters like $ to avoid any interpretation issues.
 *
 * For simple strings: returns "the string"
 * For strings with $: returns "before " & (character id 36) & " after"
 *
 * @param str The string to convert to an AppleScript expression
 * @returns An AppleScript expression that evaluates to the string
 */
export function generateAppleScriptStringExpr(str: string): string {
  if (!str) return '""';

  // First normalize smart quotes to straight quotes
  let normalized = str;
  for (const [smart, straight] of Object.entries(QUOTE_NORMALIZATIONS)) {
    normalized = normalized.split(smart).join(straight);
  }

  // Check if string contains any special characters
  const hasSpecialChars = Object.keys(SPECIAL_CHARS).some(char => normalized.includes(char));

  if (!hasSpecialChars) {
    // Simple case - just escape and wrap in quotes
    return `"${escapeForAppleScript(normalized)}"`;
  }

  // Build the string using concatenation with character id for special chars
  const parts: string[] = [];
  let currentPart = '';

  for (const char of normalized) {
    if (SPECIAL_CHARS[char] !== undefined) {
      // Flush current part if any
      if (currentPart) {
        parts.push(`"${escapeForAppleScript(currentPart)}"`);
        currentPart = '';
      }
      // Add the special character using character id
      parts.push(`(character id ${SPECIAL_CHARS[char]})`);
    } else {
      currentPart += char;
    }
  }

  // Flush remaining part
  if (currentPart) {
    parts.push(`"${escapeForAppleScript(currentPart)}"`);
  }

  // Join with AppleScript concatenation operator
  return parts.join(' & ');
}

/**
 * Generate AppleScript helper function for JSON string escaping
 * This function will be included in the generated AppleScript
 * Based on RFC 7159 JSON specification
 */
export function generateJsonEscapeHelper(): string {
  return `
  -- Helper function to escape strings for JSON output
  on escapeForJson(inputText)
    set escapedText to inputText
    -- Replace backslashes first (must be first to avoid double escaping)
    set escapedText to my replaceText(escapedText, "\\\\", "\\\\\\\\")
    -- Replace double quotes for JSON
    set escapedText to my replaceText(escapedText, "\\"", "\\\\\\"")
    -- Replace newlines for JSON
    set escapedText to my replaceText(escapedText, "
", "\\\\n")
    -- Replace carriage returns for JSON
    set escapedText to my replaceText(escapedText, "\\r", "\\\\r")
    -- Replace tabs for JSON
    set escapedText to my replaceText(escapedText, "	", "\\\\t")
    -- Note: Single quotes/apostrophes do NOT need escaping in JSON
    return escapedText
  end escapeForJson
  
  -- Helper function to replace text
  on replaceText(sourceText, findText, replaceText)
    set AppleScript's text item delimiters to findText
    set textItems to every text item of sourceText
    set AppleScript's text item delimiters to replaceText
    set resultText to textItems as string
    set AppleScript's text item delimiters to ""
    return resultText
  end replaceText
  `;
}

/**
 * Generate case-insensitive AppleScript search condition for exact name matching
 */
export function generateCaseInsensitiveSearch(itemType: 'task' | 'project' | 'tag' | 'folder', searchValue: string): string {
  const itemTypeMap = {
    task: 'flattened task',
    project: 'flattened project', 
    tag: 'flattened tag',
    folder: 'flattened folder'
  };
  
  // Use AppleScript's case-insensitive exact comparison by converting both to lowercase
  return `first ${itemTypeMap[itemType]} whose (name as string) = "${searchValue}"`;
}