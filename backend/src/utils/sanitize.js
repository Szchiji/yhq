/**
 * Escape a string for safe use in a RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape a string for safe use in a SQL LIKE / ILIKE pattern
 */
function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

module.exports = { escapeRegex, escapeLike };
