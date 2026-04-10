/**
 * XLS Export Utility
 *
 * Uses the `xlsx` library to generate .xlsx downloads.
 */

import * as XLSX from "xlsx";

export function exportToXLS(
  data: Record<string, string | number | null | undefined>[][],
  sheetNames: string[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();

  for (let i = 0; i < data.length; i++) {
    const ws = XLSX.utils.json_to_sheet(data[i]);
    XLSX.utils.book_append_sheet(wb, ws, sheetNames[i] || `Sheet${i + 1}`);
  }

  XLSX.writeFile(wb, filename);
}

/** Single-sheet convenience wrapper */
export function exportSingleSheet(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName: string = "Data"
): void {
  exportToXLS([rows], [sheetName], filename);
}
