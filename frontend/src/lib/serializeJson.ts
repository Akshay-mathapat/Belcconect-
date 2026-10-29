/**
 * Safely serializes data to JSON for embedding within an HTML <script> tag.
 * Prevents HTML breakout / cross-site scripting (XSS) by escaping <, >, &,
 * U+2028 (LINE SEPARATOR), and U+2029 (PARAGRAPH SEPARATOR).
 */
export function serializeJsonForInlineScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

