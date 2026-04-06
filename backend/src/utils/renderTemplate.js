/**
 * Render a publish template string by substituting {{variable}} placeholders.
 *
 * Supported variables:
 *   {{reportNumber}} - report sequence number
 *   {{title}}        - report title
 *   {{description}}  - report description
 *   {{username}}     - submitter's @username
 *   {{tags}}         - space-separated #tags (with trailing newline if non-empty)
 *   {{url}}          - link line (with leading newline if non-empty)
 *
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {object} vars     - Variable map
 * @returns {string}
 */
function renderPublishTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
}

/**
 * Build the variable map for a report push.
 *
 * @param {object} report        - Report model instance
 * @param {string} reportUrl     - Full URL to the report detail page
 * @param {function} isValidUrl  - Predicate to check if url is a public URL
 * @returns {object}
 */
function buildPublishVars(report, reportUrl, isValidUrl) {
  const tagsStr =
    Array.isArray(report.tags) && report.tags.length > 0
      ? '🏷 ' + report.tags.map((t) => `#${t}`).join(' ') + '\n\n'
      : '';
  const urlStr =
    typeof isValidUrl === 'function' && isValidUrl(reportUrl)
      ? `🔗 [查看报告详情](${reportUrl})`
      : '';

  return {
    reportNumber: report.reportNumber || '',
    title: report.title || '无标题',
    description: report.description || '',
    username: report.username || '匿名',
    tags: tagsStr,
    url: urlStr,
  };
}

const DEFAULT_PUBLISH_TEMPLATE =
  '📋 *报告推送* No.{{reportNumber}}\n\n' +
  '👤 @{{username}}\n' +
  '📌 {{title}}\n\n' +
  '{{description}}\n\n' +
  '{{tags}}{{url}}';

module.exports = { renderPublishTemplate, buildPublishVars, DEFAULT_PUBLISH_TEMPLATE };
