/**
 * CSV Parser for Student Data Import
 *
 * Expected columns: Name, USN, Mobile, Email
 * Branch and Section are auto-derived from USN.
 */

import { getBranchName, getSection } from "./usnValidator";

export interface CSVRow {
  usn: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  section: string;
}

export interface CSVParseResult {
  rows: CSVRow[];
  errors: { row: number; message: string }[];
}

// Columns that must exist in CSV
const REQUIRED_COLUMNS = ["name", "usn"];
// Optional columns
const OPTIONAL_COLUMNS = ["mobile", "phone", "email", "branch", "section"];

export function parseCSV(text: string): CSVParseResult {
  const rows: CSVRow[] = [];
  const errors: { row: number; message: string }[] = [];

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    errors.push({ row: 0, message: "File is empty." });
    return { rows, errors };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase().replace(/\s+/g, ""));

  // Map columns — required
  const colMap: Record<string, number> = {};
  for (const col of REQUIRED_COLUMNS) {
    const idx = headers.indexOf(col);
    if (idx === -1) {
      errors.push({ row: 1, message: `Missing required column: "${col}"` });
    } else {
      colMap[col] = idx;
    }
  }

  if (errors.length > 0) return { rows, errors };

  // Map optional columns — try "mobile" first, fall back to "phone"
  const phoneIdx = headers.indexOf("mobile") !== -1 ? headers.indexOf("mobile") : headers.indexOf("phone");
  if (phoneIdx !== -1) colMap.phone = phoneIdx;

  const emailIdx = headers.indexOf("email");
  if (emailIdx !== -1) colMap.email = emailIdx;

  // Branch/section can be in CSV or auto-derived
  const branchIdx = headers.indexOf("branch");
  if (branchIdx !== -1) colMap.branch = branchIdx;

  const sectionIdx = headers.indexOf("section");
  if (sectionIdx !== -1) colMap.section = sectionIdx;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const rowNum = i + 1;

    const usn = (values[colMap.usn] || "").trim().toUpperCase();
    const name = (values[colMap.name] || "").trim();
    const email = colMap.email !== undefined ? (values[colMap.email] || "").trim().toLowerCase() : "";
    const phone = colMap.phone !== undefined ? (values[colMap.phone] || "").trim() : "";

    // Branch/section: use CSV value if present, otherwise derive from USN
    const branch = colMap.branch !== undefined
      ? (values[colMap.branch] || "").trim().toUpperCase()
      : getBranchName(usn);
    const section = colMap.section !== undefined
      ? (values[colMap.section] || "").trim().toUpperCase()
      : getSection(usn);

    if (!usn) {
      errors.push({ row: rowNum, message: "USN is empty" });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, message: `Name is empty for ${usn}` });
      continue;
    }

    rows.push({ usn, name, email, phone, branch, section });
  }

  return { rows, errors };
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
