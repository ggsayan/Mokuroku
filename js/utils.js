/**
 * Creates a short unique ID from the current time plus random characters.
 * @returns {string} e.g. "mwhgbgq9j0ikrm"
 */
export const createId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Formats a count with a word, adding "s" when needed.
 * @param {number} count
 * @param {string} word - the singular form
 * @returns {string} e.g. "1 poster", "3 posters"
 */
export const plural = (count, word) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Turns any text into a file name that is safe on every system.
 * @param {string} text
 * @returns {string} letters, digits, "-" and "_" only; "export" if nothing is left
 */
export const toSafeFileName = (text) =>
  text.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "export";
