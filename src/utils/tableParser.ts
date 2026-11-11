// Enhanced document structure and table detection utility

export interface ParsedDocumentBlock {
  type: 'paragraph' | 'table' | 'bullet_list' | 'heading' | 'code_snippet';
  content?: string;
  tableData?: {
    headers: string[];
    rows: string[][];
    title?: string;
  };
  listItems?: string[];
}

/**
 * Checks if a line is an XML, JSON, or code snippet (like <wfm:type>...</wfm:type>)
 */
function isCodeOrXmlLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('<') ||
    trimmed.endsWith('>') ||
    trimmed.startsWith('{') ||
    trimmed.endsWith('}') ||
    trimmed.startsWith('wfm:') ||
    trimmed.includes('</') ||
    trimmed.includes('/>')
  );
}

/**
 * Checks if a line is a list item (e.g. "5. UC_CIHAZ_YER...", "a. Mevcut alanlara...", "• Madde", "- Şart")
 */
function isListItemLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^(?:[0-9]+[\.\)]\s+|[a-zA-Z][\.\)]\s+|[•\-\*]\s+)/i.test(trimmed)
  );
}

/**
 * Checks if a line is a genuine table row:
 * Must have at least 2 distinct columns separated by TAB, PIPE, or 3+ spaces,
 * AND the first column must NOT just be a simple list prefix like "5." or "a."
 */
function isGenuineTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isCodeOrXmlLine(line)) return false;

  // If it's a list item with a long sentence following (e.g. "5. \t UC_CIHAZ_YER ve COKURULUM iş emri..."), it's an indented list item, NOT a multi-column table!
  if (/^(?:[0-9]+[\.\)]|[a-zA-Z][\.\)])\s+/i.test(trimmed)) {
    return false;
  }

  // Check pipe table (e.g. | col1 | col2 | col3 |)
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim()).filter((p) => p.length > 0);
    return parts.length >= 2;
  }

  // Check tab separation (must have at least 2 non-empty segments, each having real column content)
  if (line.includes('\t')) {
    const parts = line.split('\t').map((p) => p.trim()).filter((p) => p.length > 0);
    // If it has 2+ columns and does not start with a list bullet
    if (parts.length >= 2) {
      const firstColIsBullet = /^(?:[0-9]+[\.\)]|[a-zA-Z][\.\)]|[•\-\*])$/i.test(parts[0]);
      if (firstColIsBullet && parts.length === 2) {
        return false; // Just bullet + text separated by tab (Word indentation)
      }
      return true;
    }
  }

  return false;
}

export function detectTablesAndStructures(rawText: string): ParsedDocumentBlock[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const blocks: ParsedDocumentBlock[] = [];

  let currentTableLines: string[] = [];
  let currentListLines: string[] = [];
  let currentCodeLines: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join('\n').trim();
      if (text) {
        if (/^(Tablo\s+\d+|[0-9]+\.\s+[A-ZÇĞİÖŞÜ]|##)/i.test(text) && text.length < 100) {
          blocks.push({ type: 'heading', content: text });
        } else {
          blocks.push({ type: 'paragraph', content: text });
        }
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentListLines.length > 0) {
      blocks.push({
        type: 'bullet_list',
        listItems: [...currentListLines],
      });
      currentListLines = [];
    }
  };

  const flushCode = () => {
    if (currentCodeLines.length > 0) {
      blocks.push({
        type: 'code_snippet',
        content: currentCodeLines.join('\n'),
      });
      currentCodeLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      const table = parseTableLines(currentTableLines);
      // Valid table must have at least 2 columns and at least 2 rows (header + at least 1 data row)
      if (table && table.headers.length >= 2 && table.rows.length >= 1) {
        blocks.push({
          type: 'table',
          tableData: table,
        });
      } else {
        // Fallback to regular lines
        currentTableLines.forEach((tl) => {
          if (isListItemLine(tl)) {
            currentListLines.push(tl.trim());
          } else {
            currentParagraphLines.push(tl);
          }
        });
      }
      currentTableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushCode();
      flushTable();
      continue;
    }

    // Check code/xml block (e.g. <wfm:resource>...)
    if (isCodeOrXmlLine(line)) {
      flushParagraph();
      flushList();
      flushTable();
      currentCodeLines.push(line);
      continue;
    } else {
      flushCode();
    }

    // Check genuine table row
    if (isGenuineTableRow(line)) {
      flushParagraph();
      flushList();
      currentTableLines.push(line);
      continue;
    } else {
      flushTable();
    }

    // Check bullet or numbered list
    if (isListItemLine(line)) {
      flushParagraph();
      currentListLines.push(trimmed);
      continue;
    } else {
      flushList();
    }

    // Regular paragraph or heading
    currentParagraphLines.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();
  flushTable();

  return blocks;
}

function parseTableLines(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length === 0) return null;

  const parsedGrid: string[][] = [];

  for (const line of lines) {
    let cells: string[] = [];
    if (line.includes('\t')) {
      cells = line.split('\t').map((c) => c.trim());
    } else if (line.includes('|')) {
      cells = line.split('|').map((c) => c.trim()).filter((c, idx, arr) => {
        if ((idx === 0 || idx === arr.length - 1) && c === '') return false;
        return true;
      });
    } else {
      cells = line.split(/\s{3,}/).map((c) => c.trim());
    }

    if (cells.length >= 2 && cells.some((c) => c.length > 0)) {
      const isSep = cells.every((c) => /^[\-\:\s]+$/.test(c));
      if (!isSep) {
        parsedGrid.push(cells);
      }
    }
  }

  if (parsedGrid.length < 2) return null;

  const maxCols = Math.max(...parsedGrid.map((row) => row.length));
  if (maxCols < 2) return null;

  const headers = parsedGrid[0];
  const rows = parsedGrid.slice(1);

  const normalizedRows = rows.map((row) => {
    const padded = [...row];
    while (padded.length < headers.length) {
      padded.push('');
    }
    return padded;
  });

  return {
    headers,
    rows: normalizedRows,
  };
}
