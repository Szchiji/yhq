/**
 * Escape a string for safe use in a RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize an object to remove MongoDB operator keys (keys starting with $)
 * to prevent NoSQL injection attacks.
 */
function sanitizeMongoQuery(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) continue;
    const val = obj[key];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      sanitized[key] = sanitizeMongoQuery(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

module.exports = { escapeRegex, sanitizeMongoQuery };
