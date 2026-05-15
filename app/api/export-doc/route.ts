import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseMarkdown(markdown: string): { type: string; content: string; items?: string[] }[] {
  const lines = markdown.split('\n');
  const result: { type: string; content: string; items?: string[] }[] = [];
  let currentTable: string[] = [];
  let inTable = false;
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      result.push({ type: 'list', content: '', items: [...listBuffer] });
      listBuffer = [];
    }
  };

  const flushTable = () => {
    if (currentTable.length > 0) {
      result.push({ type: 'table', content: currentTable.join('\n') });
      currentTable = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      if (inTable) flushTable();
      continue;
    }

    if (trimmedLine.startsWith('### ')) {
      flushList(); flushTable();
      result.push({ type: 'heading3', content: trimmedLine.slice(4) });
      continue;
    }
    if (trimmedLine.startsWith('## ')) {
      flushList(); flushTable();
      result.push({ type: 'heading2', content: trimmedLine.slice(3) });
      continue;
    }
    if (trimmedLine.startsWith('# ')) {
      flushList(); flushTable();
      result.push({ type: 'heading1', content: trimmedLine.slice(2) });
      continue;
    }

    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      flushTable();
      listBuffer.push(trimmedLine.slice(2));
      continue;
    }

    if (trimmedLine.startsWith('|')) {
      inTable = true;
      // 跳过分隔行 (|---|---|)
      if (/^[\|\s\-\:]+$/.test(trimmedLine)) continue;
      const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        currentTable.push(cells.join('|'));
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    flushList();

    // 去掉markdown格式标记
    let processedLine = trimmedLine
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1');

    result.push({ type: 'text', content: processedLine });
  }

  flushList();
  flushTable();

  return result;
}

function markdownToDocx(markdown: string): Document {
  const parsed = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];

  for (const item of parsed) {
    switch (item.type) {
      case 'heading1':
        children.push(new Paragraph({
          text: item.content,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }));
        break;

      case 'heading2':
        children.push(new Paragraph({
          text: item.content,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }));
        break;

      case 'heading3':
        children.push(new Paragraph({
          text: item.content,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }));
        break;

      case 'text':
        children.push(new Paragraph({
          text: item.content,
          spacing: { after: 200 },
        }));
        break;

      case 'list':
        for (const listItem of item.items || []) {
          children.push(new Paragraph({
            text: listItem,
            bullet: { level: 0 },
            spacing: { after: 100 },
          }));
        }
        break;

      case 'table': {
        const rows = item.content.split('\n').filter(l => l.trim());
        if (rows.length === 0) break;
        
        const tableRows: TableRow[] = rows.map((row, rowIndex) => {
          const cells = row.split('|').map(c => c.trim()).filter(c => c);
          return new TableRow({
            children: cells.map(cell => 
              new TableCell({
                children: [new Paragraph({ 
                  text: cell,
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 50, after: 50 },
                })],
                shading: rowIndex === 0 ? { fill: 'D9E2F3' } : undefined,
                width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
              })
            ),
          });
        });

        if (tableRows.length > 0) {
          children.push(new Table({
            rows: tableRows,
            width: { size: 9000, type: WidthType.DXA },
          }));
          children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
        }
        break;
      }
    }
  }

  return new Document({
    sections: [{
      properties: {},
      children,
    }],
  });
}

export async function POST(request: NextRequest) {
  try {
    const { markdown } = await request.json();

    if (!markdown || typeof markdown !== 'string') {
      return NextResponse.json({ error: '请提供Markdown内容' }, { status: 400 });
    }

    const doc = markdownToDocx(markdown);
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="document.docx"',
      },
    });
  } catch (error) {
    console.error('导出DOC错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
