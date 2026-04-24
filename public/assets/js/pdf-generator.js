/**
 * PdfGenerator — Builds PDF from markdown using pdfmake
 * Flow: markdown string → marked.lexer() tokens → pdfmake document definition → PDF
 */
window.PdfGenerator = (() => {

  // Uses Roboto — pdfmake's built-in default from vfs_fonts.js

  const PAGE_CONFIGS = {
    A4:     { label: 'A4 (210\u00d7297mm)',  size: 'A4',     width: 595.28, height: 841.89 },
    Letter: { label: 'Letter (8.5\u00d711")', size: 'LETTER', width: 612,    height: 792 },
    Legal:  { label: 'Legal (8.5\u00d714")',  size: 'LEGAL',  width: 612,    height: 1008 },
  };

  const MARGINS = { left: 40, top: 72, right: 40, bottom: 56 };

  const DEFAULT_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="200" height="60" rx="8" fill="#E5E5E5"/><text x="100" y="35" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#737373">Your Logo</text></svg>';

  // Ensure SVG has a viewBox so pdfmake can scale it properly (prevents clipping)
  function ensureSvgViewBox(svgString) {
    if (!svgString || svgString.includes('viewBox')) return svgString;
    const wMatch = svgString.match(/\bwidth=["'](\d+(?:\.\d+)?)(?:px)?["']/);
    const hMatch = svgString.match(/\bheight=["'](\d+(?:\.\d+)?)(?:px)?["']/);
    if (wMatch && hMatch) {
      return svgString.replace(/(<svg\b)/, `$1 viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`);
    }
    return svgString;
  }

  // ── Decode HTML entities that marked.lexer() produces ────
  function decodeEntities(str) {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // ── Inline token processing ──────────────────────────────
  function processInlineTokens(tokens) {
    if (!tokens || tokens.length === 0) return [];
    const result = [];
    for (const token of tokens) {
      switch (token.type) {
        case 'text':
          result.push({ text: decodeEntities(token.text) });
          break;
        case 'strong':
          result.push({ text: processInlineTokens(token.tokens), bold: true });
          break;
        case 'em':
          result.push({ text: processInlineTokens(token.tokens), italics: true });
          break;
        case 'codespan':
          result.push({ text: decodeEntities(token.text), font: 'Courier', fontSize: 10, background: '#f0f0f0', color: '#c7254e' });
          break;
        case 'link':
          result.push({ text: processInlineTokens(token.tokens), link: token.href, color: '#1565C0', decoration: 'underline' });
          break;
        case 'del':
          result.push({ text: processInlineTokens(token.tokens), decoration: 'lineThrough' });
          break;
        case 'br':
          result.push({ text: '\n' });
          break;
        case 'escape':
          result.push({ text: decodeEntities(token.text) });
          break;
        case 'image':
          result.push({ text: `[Image: ${decodeEntities(token.text) || token.href}]`, italics: true, color: '#999999' });
          break;
        default:
          if (token.text) result.push({ text: decodeEntities(token.text) });
          else if (token.raw) result.push({ text: decodeEntities(token.raw) });
          break;
      }
    }
    return result;
  }

  // ── List item processing ─────────────────────────────────
  function processListItem(item, contentWidth) {
    const parts = [];
    for (const token of item.tokens) {
      switch (token.type) {
        case 'text':
          if (token.tokens && token.tokens.length > 0) {
            parts.push({ text: processInlineTokens(token.tokens) });
          } else {
            parts.push({ text: token.text });
          }
          break;
        case 'paragraph':
          parts.push({ text: processInlineTokens(token.tokens) });
          break;
        case 'list': {
          const subItems = token.items.map(sub => processListItem(sub, contentWidth));
          parts.push(token.ordered ? { ol: subItems } : { ul: subItems });
          break;
        }
        default: {
          const converted = tokensToContent([token], contentWidth);
          parts.push(...converted);
        }
      }
    }
    if (parts.length === 0) return { text: '' };
    if (parts.length === 1) return parts[0];
    return { stack: parts };
  }

  // ── Block token processing ───────────────────────────────
  function tokensToContent(tokens, contentWidth) {
    const content = [];
    for (const token of tokens) {
      switch (token.type) {
        case 'heading': {
          const depth = token.depth;
          const node = {
            text: processInlineTokens(token.tokens),
            style: `h${depth}`,
          };
          if (depth <= 2) {
            node.tocItem = true;
            node.tocMargin = depth === 2 ? [16, 2, 0, 2] : [0, 2, 0, 2];
          }
          content.push(node);
          break;
        }

        case 'paragraph':
          content.push({
            text: processInlineTokens(token.tokens),
            style: 'body',
          });
          break;

        case 'list': {
          const listItems = token.items.map(item => processListItem(item, contentWidth));
          const listObj = token.ordered
            ? { ol: listItems, margin: [0, 4, 0, 4] }
            : { ul: listItems, margin: [0, 4, 0, 4] };
          if (token.ordered && token.start !== undefined && token.start > 1) {
            listObj.start = token.start;
          }
          content.push(listObj);
          break;
        }

        case 'table': {
          const body = [];
          body.push(token.header.map(cell => ({
            text: processInlineTokens(cell.tokens),
            bold: true,
            fillColor: '#f5f5f5',
            margin: [4, 4, 4, 4],
          })));
          for (const row of token.rows) {
            body.push(row.map(cell => ({
              text: processInlineTokens(cell.tokens),
              margin: [4, 4, 4, 4],
            })));
          }
          content.push({
            table: {
              headerRows: 1,
              widths: Array(token.header.length).fill('*'),
              body,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#e0e0e0',
              vLineColor: () => '#e0e0e0',
            },
            margin: [0, 6, 0, 6],
          });
          break;
        }

        case 'code':
          content.push({
            table: {
              widths: ['*'],
              body: [[{
                text: decodeEntities(token.text),
                font: 'Courier',
                fontSize: 10,
                color: '#333333',
                preserveLeadingSpaces: true,
                margin: [8, 8, 8, 8],
              }]],
            },
            layout: {
              fillColor: () => '#f8f8f8',
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#e0e0e0',
              vLineColor: () => '#e0e0e0',
            },
            margin: [0, 6, 0, 6],
          });
          break;

        case 'blockquote': {
          const bqContent = tokensToContent(token.tokens, contentWidth - 23);
          content.push({
            table: {
              widths: [3, '*'],
              body: [[
                { text: '', fillColor: '#d0d0d0', margin: [0, 0, 0, 0] },
                { stack: bqContent, margin: [10, 4, 0, 4], color: '#555555' },
              ]],
            },
            layout: 'noBorders',
            margin: [0, 6, 0, 6],
          });
          break;
        }

        case 'hr':
          content.push({
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: '#e0e0e0' }],
            margin: [0, 10, 0, 10],
          });
          break;

        case 'space':
        case 'html':
          break;
      }
    }
    return content;
  }

  // ── Build full pdfmake document definition ───────────────
  function buildDocument({ title, logoSvg, versions, pdfStyles, markdown, pageSize }) {
    const styles = window.StyleManager.mergeStyles(pdfStyles);
    const pc = PAGE_CONFIGS[pageSize] || PAGE_CONFIGS.Legal;
    const contentWidth = pc.width - MARGINS.left - MARGINS.right;
    const contentHeight = pc.height - MARGINS.top - MARGINS.bottom;

    const tokens = marked.lexer(markdown || '');
    const contentNodes = tokensToContent(tokens, contentWidth);

    const latestVersion = versions.length > 0 ? versions[versions.length - 1] : null;
    const versionStr = latestVersion ? latestVersion.version : '';
    const svg = ensureSvgViewBox(logoSvg || DEFAULT_LOGO_SVG);
    const docTitle = title || 'Policy Name';

    // ─ Cover page ─────────────────────────────────────────
    const coverApproxHeight = (logoSvg ? 130 : 0) + 50 + (latestVersion ? 50 : 0);
    const coverTopSpacer = Math.max(60, (contentHeight - coverApproxHeight) / 2 - 20);

    const coverContent = [
      { text: '', margin: [0, coverTopSpacer, 0, 0] },
    ];
    coverContent.push({ svg: svg, fit: [160, 100], alignment: 'center', margin: [0, 0, 0, 30] });
    coverContent.push({
      text: docTitle,
      fontSize: 28, bold: true, color: styles.h1.color,
      alignment: 'center', margin: [0, 0, 0, 16],
    });
    if (latestVersion) {
      coverContent.push({
        text: `Version ${latestVersion.version}`,
        fontSize: 14, color: '#666666', alignment: 'center', margin: [0, 0, 0, 4],
      });
      coverContent.push({
        text: `Updated: ${latestVersion.date}`,
        fontSize: 12, color: '#666666', alignment: 'center',
      });
    }
    coverContent.push({ text: '', pageBreak: 'after' });

    // ─ TOC ────────────────────────────────────────────────
    const tocContent = [
      { text: 'Table of Contents', fontSize: parseInt(styles.h2.size, 10), bold: true, color: styles.h2.color, margin: [0, 0, 0, 16] },
      {
        toc: {
          numberStyle: { fontSize: parseInt(styles.body.size, 10), color: styles.body.color },
          textStyle: { color: styles.body.color },
        },
      },
      { text: '', pageBreak: 'after' },
    ];

    // ─ Version history ────────────────────────────────────
    const vhContent = [];
    if (versions.length > 0) {
      const vhBody = [
        [
          { text: 'Version', bold: true, fillColor: '#f5f5f5', color: styles.body.color, margin: [6, 6, 6, 6] },
          { text: 'Date', bold: true, fillColor: '#f5f5f5', color: styles.body.color, margin: [6, 6, 6, 6] },
          { text: 'Updated By', bold: true, fillColor: '#f5f5f5', color: styles.body.color, margin: [6, 6, 6, 6] },
        ],
      ];
      for (const v of [...versions].reverse()) {
        vhBody.push([
          { text: v.version || '', color: styles.body.color, margin: [6, 6, 6, 6] },
          { text: v.date || '', color: styles.body.color, margin: [6, 6, 6, 6] },
          { text: v.updatedBy || '', color: styles.body.color, margin: [6, 6, 6, 6] },
        ]);
      }
      vhContent.push(
        { text: 'Version History', fontSize: parseInt(styles.h2.size, 10), bold: true, color: styles.h2.color, pageBreak: 'before', margin: [0, 0, 0, 12] },
        {
          table: { headerRows: 1, widths: ['auto', 'auto', '*'], body: vhBody },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e0e0e0',
            vLineColor: () => '#e0e0e0',
          },
        }
      );
    }

    // ─ Document definition ────────────────────────────────
    return {
      pageSize: pc.size,
      pageMargins: [MARGINS.left, MARGINS.top, MARGINS.right, MARGINS.bottom],

      header(currentPage) {
        if (currentPage === 1) return null;
        return {
          stack: [
            {
              columns: [
                { text: docTitle, fontSize: 9, color: '#666666', width: '*', margin: [0, 4, 0, 0] },
                { svg: svg, fit: [80, 28], alignment: 'right' },
              ],
              margin: [MARGINS.left, 20, MARGINS.right, 0],
            },
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: '#e0e0e0' }],
              margin: [MARGINS.left, 6, MARGINS.right, 0],
            },
          ],
        };
      },

      footer(currentPage, pageCount) {
        if (currentPage === 1) return null;
        const pageNum = currentPage - 1;
        const totalPages = pageCount - 1;
        return {
          stack: [
            {
              canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: '#e0e0e0' }],
              margin: [MARGINS.left, 0, MARGINS.right, 0],
            },
            {
              columns: [
                { text: versionStr ? `v${versionStr}` : '', fontSize: 9, color: '#666666' },
                { text: `Page ${pageNum} of ${totalPages}`, fontSize: 9, color: '#666666', alignment: 'right' },
              ],
              margin: [MARGINS.left, 6, MARGINS.right, 0],
            },
          ],
        };
      },

      content: [
        ...coverContent,
        ...tocContent,
        ...contentNodes,
        ...vhContent,
      ],

      styles: {
        h1: { fontSize: parseInt(styles.h1.size, 10), bold: true, color: styles.h1.color, margin: [0, 24, 0, 8] },
        h2: { fontSize: parseInt(styles.h2.size, 10), bold: true, color: styles.h2.color, margin: [0, 20, 0, 6] },
        h3: { fontSize: parseInt(styles.h3.size, 10), bold: true, color: styles.h3.color, margin: [0, 16, 0, 6] },
        h4: { fontSize: parseInt(styles.h4.size, 10), bold: true, color: styles.h4.color, margin: [0, 14, 0, 4] },
        h5: { fontSize: parseInt(styles.h5.size, 10), bold: true, color: styles.h5.color, margin: [0, 12, 0, 4] },
        body: { fontSize: parseInt(styles.body.size, 10), color: styles.body.color, lineHeight: 1.6, margin: [0, 3, 0, 3] },
      },

      defaultStyle: {
        font: 'Roboto',
        fontSize: parseInt(styles.body.size, 10) || 12,
        color: styles.body.color || '#333333',
        lineHeight: 1.5,
      },
    };
  }

  // ── Public API ───────────────────────────────────────────
  async function generate(params) {
    const docDef = buildDocument(params);
    const filename = (params.title || 'policy').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || 'policy';
    pdfMake.createPdf(docDef).download(`${filename}.pdf`);
  }

  function getBlob(params) {
    return new Promise((resolve, reject) => {
      try {
        const docDef = buildDocument(params);
        pdfMake.createPdf(docDef).getBlob(blob => resolve(blob));
      } catch (e) {
        reject(e);
      }
    });
  }

  return { generate, getBlob, PAGE_CONFIGS };
})();
