const fs = require('fs');
const path = require('path');

const apiDocPath = path.join(__dirname, '..', 'API_DOCUMENTATION.md');
const outputPath = path.join(__dirname, '..', 'postman', 'printable-api-docs.html');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inCodeBlock = false;
  let inList = false;
  let inTable = false;
  let tableHeaderDone = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${paragraph.join(' ')}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
      tableHeaderDone = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      flushParagraph();
      closeList();
      closeTable();

      if (!inCodeBlock) {
        inCodeBlock = true;
        html.push('<pre><code>');
      } else {
        inCodeBlock = false;
        html.push('</code></pre>');
      }
      continue;
    }

    if (inCodeBlock) {
      html.push(`${escapeHtml(rawLine)}\n`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      closeTable();
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      closeList();
      closeTable();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,6}\s+/, '');
      html.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      continue;
    }

    if (/^- /.test(line)) {
      flushParagraph();
      closeTable();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.replace(/^- /, ''))}</li>`);
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      flushParagraph();
      closeList();
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());

      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        html.push('<table>');
      }

      if (!tableHeaderDone) {
        html.push('<thead><tr>');
        for (const cell of cells) {
          html.push(`<th>${escapeHtml(cell)}</th>`);
        }
        html.push('</tr></thead><tbody>');
        tableHeaderDone = true;
      } else {
        html.push('<tr>');
        for (const cell of cells) {
          html.push(`<td>${escapeHtml(cell)}</td>`);
        }
        html.push('</tr>');
      }
      continue;
    }

    closeList();
    closeTable();
    paragraph.push(escapeHtml(line));
  }

  flushParagraph();
  closeList();
  closeTable();

  return html.join('\n');
}

function buildPage(bodyHtml) {
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sci-Request API Docs Printable</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #18202b;
      --muted: #5d6b7a;
      --line: #d6dce3;
      --panel: #f5f7fa;
      --accent: #113f67;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background: white;
      line-height: 1.6;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 32px 72px;
    }

    .hero {
      border-bottom: 2px solid var(--accent);
      margin-bottom: 24px;
      padding-bottom: 16px;
    }

    .hero h1 {
      margin: 0 0 8px;
      font-size: 2rem;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--accent);
      line-height: 1.25;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      page-break-after: avoid;
    }

    p, ul, table, pre {
      margin: 0 0 1rem;
    }

    ul {
      padding-left: 1.3rem;
    }

    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.92em;
      background: #f1f4f8;
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }

    pre {
      overflow-x: auto;
      background: var(--panel);
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      white-space: pre-wrap;
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }

    th, td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
      text-align: left;
    }

    th {
      background: var(--panel);
    }

    @media print {
      body {
        background: white;
      }

      .page {
        max-width: none;
        padding: 0;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      pre, table {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>Sci-Request API Docs</h1>
      <p>Printable HTML generated from backend/API_DOCUMENTATION.md. Open in a browser and use Print -> Save as PDF.</p>
    </section>
    ${bodyHtml}
  </main>
</body>
</html>
`;
}

const markdown = fs.readFileSync(apiDocPath, 'utf8');
const bodyHtml = markdownToHtml(markdown);
fs.writeFileSync(outputPath, buildPage(bodyHtml));

console.log(`Printable API docs generated at: ${outputPath}`);
