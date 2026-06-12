import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  key: keyof T | ((row: T) => string | number | null | undefined);
  width?: number;
}

export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName: string,
  fileName: string
): void {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      if (typeof col.key === "function") return col.key(row) ?? "";
      const v = row[col.key as string];
      return v ?? "";
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 20 }));

  // Header style (bold)
  headers.forEach((_, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (!ws[cellRef]) return;
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "F1F5F9" } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string
): void {
  const headers = columns.map((c) => c.header).join(",");
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const v =
          typeof col.key === "function"
            ? col.key(row)
            : row[col.key as string];
        const str = String(v ?? "").replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str}"`
          : str;
      })
      .join(",")
  );

  const csv = [headers, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
