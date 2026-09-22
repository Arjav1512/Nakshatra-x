/**
 * Planning-view export (PRD D-8).
 *
 * Two formats, both dependency-free:
 *   CSV  — opens directly in Excel. Chosen over a real .xlsx writer because
 *          that needs a spreadsheet library, and a planning extract is tabular;
 *          see docs/DECISIONS.md D-019.
 *   PDF  — the browser's own print-to-PDF against a print stylesheet.
 *
 * Every exported row carries its provenance columns, so a figure pasted into a
 * planning deck still says where it came from (PRD N-3).
 */

export interface ExportRow {
  section: string
  metric: string
  value: string | number
  unit: string
  source: string
  source_kind: string
  vintage: string
  model_version: string
  uncertainty: string
  is_synthetic: boolean | string
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(rows: ExportRow[], header: Record<string, string>): string {
  const preamble = Object.entries(header).map(([k, v]) => `# ${k}: ${v}`)
  const cols: (keyof ExportRow)[] = [
    'section', 'metric', 'value', 'unit', 'source', 'source_kind',
    'vintage', 'model_version', 'uncertainty', 'is_synthetic',
  ]
  const lines = [
    ...preamble,
    cols.join(','),
    ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')),
  ]
  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  // Prepend a BOM so Excel reads UTF-8 (the ₹ and × in these extracts) correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPdf(): void {
  // The print stylesheet in the console hides chrome and expands evidence.
  window.print()
}
