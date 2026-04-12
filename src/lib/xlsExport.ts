/**
 * XLS Export Utility — ExcelJS-based beautiful exports
 *
 * Styled headers, auto column widths, currency formatting,
 * alternating rows, freeze pane, and auto-filter.
 */

import ExcelJS from "exceljs";

// Brand colours
const INK = "FF0D0D0D";
const PAPER2 = "FFE8E4DD";
const RED = "FFE8341A";
const WHITE = "FFFFFFFF";
const STRIPE = "FFF7F4EE"; // light alternating row

// ── helpers ────────────────────────────────────────────────────────────────

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: WHITE }, name: "Calibri", size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
  cell.border = {
    top: { style: "thin", color: { argb: INK } },
    left: { style: "thin", color: { argb: INK } },
    bottom: { style: "thin", color: { argb: INK } },
    right: { style: "thin", color: { argb: INK } },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
}

function applyDataStyle(cell: ExcelJS.Cell, rowIndex: number, isAmount = false) {
  const isEven = rowIndex % 2 === 0;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: isEven ? STRIPE : WHITE },
  };
  cell.border = {
    top: { style: "hair", color: { argb: "FFCCCCCC" } },
    left: { style: "hair", color: { argb: "FFCCCCCC" } },
    bottom: { style: "hair", color: { argb: "FFCCCCCC" } },
    right: { style: "hair", color: { argb: "FFCCCCCC" } },
  };
  cell.font = { name: "Calibri", size: 10, color: { argb: INK } };
  cell.alignment = {
    vertical: "middle",
    horizontal: isAmount ? "right" : "left",
  };
}

function applyTitleRowStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: WHITE }, name: "Calibri", size: 13 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function columnWidth(key: string): number {
  const widths: Record<string, number> = {
    "#": 5,
    "Name": 24,
    "USN": 18,
    "Email": 30,
    "Phone": 16,
    "Branch": 14,
    "Section": 10,
    "Event 1": 26,
    "Event 2": 26,
    "Payment Status": 16,
    "Payment Status (Event 2)": 22,
    "Transaction ID (Event 1)": 28,
    "Transaction ID (Event 2)": 28,
    "Amount Paid — Event 1": 20,
    "Amount Paid — Event 2": 20,
    "Total Amount Paid": 18,
    "Event Name": 26,
    "Transaction ID": 28,
    "Amount Paid": 16,
  };
  return widths[key] ?? Math.max(key.length + 4, 14);
}

function formatAmount(val: string | number | null | undefined): string {
  if (val == null || val === "" || val === 0 || val === "0") return "₹ 0 (Free)";
  const n = Number(val);
  if (isNaN(n) || n === 0) return "₹ 0 (Free)";
  return `₹ ${n.toLocaleString("en-IN")}`;
}

// ── main export ─────────────────────────────────────────────────────────────

export async function exportToXLS(
  data: Record<string, string | number | null | undefined>[][],
  sheetNames: string[],
  filename: string,
  amountKeys: string[] = ["Amount Paid (₹)", "Amount Paid", "Amount Paid — Event 1", "Amount Paid — Event 2", "Total Amount Paid"],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Idea Lab — DBIT Bangalore";
  wb.created = new Date();

  for (let si = 0; si < data.length; si++) {
    const rows = data[si];
    const sheetName = (sheetNames[si] || `Sheet${si + 1}`).slice(0, 31);
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    if (rows.length === 0) {
      ws.addRow(["No data available"]);
      continue;
    }

    const keys = Object.keys(rows[0]);

    // ── title row ──────────────────────────────────────────────────────────
    const titleRow = ws.addRow([`Idea Lab — ${sheetName}   |   DBIT Bangalore   |   Exported: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`]);
    ws.mergeCells(1, 1, 1, keys.length);
    applyTitleRowStyle(titleRow.getCell(1));
    titleRow.height = 26;

    // ── header row ─────────────────────────────────────────────────────────
    const headerRow = ws.addRow(keys);
    headerRow.height = 22;
    headerRow.eachCell((cell) => applyHeaderStyle(cell));

    // freeze title + header
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

    // auto-filter on header row (row 2)
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: keys.length } };

    // ── data rows ──────────────────────────────────────────────────────────
    rows.forEach((rowData, ri) => {
      const values = keys.map((k) => {
        const raw = rowData[k];
        if (amountKeys.includes(k)) return formatAmount(raw);
        if (raw == null) return "";
        return raw;
      });
      const row = ws.addRow(values);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const key = keys[colNum - 1];
        applyDataStyle(cell, ri, amountKeys.includes(key));
      });
    });

    // ── column widths ──────────────────────────────────────────────────────
    ws.columns.forEach((col, i) => {
      col.width = columnWidth(keys[i]);
    });
  }

  // ── write & download ────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Single-sheet convenience wrapper */
export async function exportSingleSheet(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName = "Data"
): Promise<void> {
  await exportToXLS([rows], [sheetName], filename);
}
