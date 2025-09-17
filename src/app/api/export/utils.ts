import type { Workbook } from 'exceljs';

/**
 * Converts an ExcelJS workbook to an ArrayBuffer for use in HTTP responses
 */
export async function workbookToResponseBuffer(wb: Workbook): Promise<ArrayBuffer> {
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Creates standard metadata for Excel workbooks
 */
export function makeWorkbookMetadata(title: string) {
  const now = new Date();
  return {
    created: now,
    modified: now,
    lastModifiedBy: 'Chronos System',
    title,
    subject: `${title} Export`,
    keywords: 'chronos,export,data',
    category: 'Data Export',
    company: 'Chronos',
    manager: 'Administrator',
  };
}
