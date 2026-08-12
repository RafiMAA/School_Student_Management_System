import { saveAs } from 'file-saver';

type CsvCell = string | number | boolean | null | undefined;

function encodeCell(value: CsvCell): string {
  let text = value == null ? '' : String(value);
  // Prevent values controlled by users from becoming spreadsheet formulas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCsv(filename: string, rows: CsvCell[][]): void {
  const csv = rows.map(row => row.map(encodeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
