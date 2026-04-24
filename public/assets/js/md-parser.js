/**
 * MdParser — YAML frontmatter parse/serialize for policy markdown files
 * Metadata is stored in HTML comments so .md files render cleanly in any viewer.
 *
 * Format:
 *   <!--
 *   ---
 *   title: My Policy
 *   created: '2026-04-24T07:00:00.000Z'
 *   ---
 *   -->
 *
 *   # 1. Purpose
 *   ...
 */
window.MdParser = (() => {
  // New format: metadata inside HTML comment
  const COMMENT_FM_RE = /^<!--\s*\r?\n---\r?\n([\s\S]*?)\r?\n---\s*\r?\n-->\r?\n?([\s\S]*)$/;
  // Legacy format: bare YAML frontmatter (still supported for import)
  const BARE_FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

  const DOC_SEPARATOR = '<!-- ===POLICY-BREAK=== -->';

  function toISODate(val) {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = String(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0];
  }

  function parse(mdString) {
    const defaults = {
      title: '',
      logo: '',
      versions: [],
      pdfStyles: {},
      created: '',
      updated: '',
      pageSize: 'Legal',
      body: '',
    };

    if (!mdString || typeof mdString !== 'string') return defaults;

    // Try comment format first, then legacy bare format
    const match = mdString.match(COMMENT_FM_RE) || mdString.match(BARE_FM_RE);
    if (!match) {
      return { ...defaults, body: mdString.trim() };
    }

    let meta = {};
    try {
      meta = jsyaml.load(match[1], { schema: jsyaml.JSON_SCHEMA }) || {};
    } catch (e) {
      console.warn('Failed to parse YAML frontmatter:', e);
      return { ...defaults, body: mdString.trim() };
    }

    return {
      id: String(meta.id || ''),
      title: String(meta.title || ''),
      logo: String(meta.logo || ''),
      versions: Array.isArray(meta.versions) ? meta.versions.map(v => ({
        version: String(v.version || ''),
        date: toISODate(v.date),
        reviewer: String(v.reviewer || ''),
      })).sort((a, b) => (b.date || '').localeCompare(a.date || '')) : [],
      pdfStyles: meta.pdfStyles || {},
      pageSize: String(meta.pageSize || 'Legal'),
      created: String(meta.created || ''),
      updated: String(meta.updated || ''),
      body: (match[2] || '').trim(),
    };
  }

  function serialize(metadata, body) {
    const meta = {};

    if (metadata.id) meta.id = metadata.id;
    if (metadata.title) meta.title = metadata.title;
    if (metadata.logo) meta.logo = metadata.logo;
    if (metadata.created) meta.created = metadata.created;
    if (metadata.updated) meta.updated = metadata.updated;

    if (metadata.versions && metadata.versions.length > 0) {
      meta.versions = [...metadata.versions]
        .filter(v => v.version || v.date || v.reviewer)
        .map(v => ({
          version: v.version,
          date: toISODate(v.date),
          reviewer: v.reviewer,
        }))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }

    if (metadata.pageSize && metadata.pageSize !== 'Legal') {
      meta.pageSize = metadata.pageSize;
    }

    if (metadata.pdfStyles && Object.keys(metadata.pdfStyles).length > 0) {
      const diff = window.StyleManager
        ? window.StyleManager.diffFromDefaults(metadata.pdfStyles)
        : metadata.pdfStyles;
      if (Object.keys(diff).length > 0) {
        meta.pdfStyles = diff;
      }
    }

    const hasMetadata = Object.keys(meta).length > 0;
    if (!hasMetadata) return body || '';

    const yamlStr = jsyaml.dump(meta, { lineWidth: -1, noRefs: true });
    return `<!--\n---\n${yamlStr}---\n-->\n\n${body || ''}`;
  }

  function splitMultiDoc(content) {
    if (!content.includes(DOC_SEPARATOR)) return [content];
    return content.split(DOC_SEPARATOR).map(s => s.trim()).filter(Boolean);
  }

  function joinMultiDoc(docs) {
    return docs.join('\n\n' + DOC_SEPARATOR + '\n\n');
  }

  return { parse, serialize, splitMultiDoc, joinMultiDoc, DOC_SEPARATOR };
})();
