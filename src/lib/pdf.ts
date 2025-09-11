
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function downloadTableAsPDF({
  tableId,
  filename = "data.pdf",
  title = "Data Siswa"
}: { tableId: string; filename?: string; title?: string }) {
  const doc = new jsPDF();
  const table = document.getElementById(tableId);
  if (!table) return;
  // Extract headers, remove last column (Actions)
  let headers = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent?.trim() || "");
  if (headers[headers.length - 1]?.toLowerCase().includes("action")) {
    headers = headers.slice(0, -1);
  }
  // Extract rows, remove last cell (Actions) from each row
  const body = Array.from(table.querySelectorAll("tbody tr")).map(tr => {
    const cells = Array.from(tr.querySelectorAll("td")).map(td => td.textContent?.trim() || "");
    return cells.length === headers.length + 1 ? cells.slice(0, -1) : cells;
  });
  autoTable(doc, {
    head: [headers],
    body,
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', minCellWidth: 30 },
    headStyles: { fillColor: [99, 102, 241], halign: 'center', fontStyle: 'bold' },
    bodyStyles: { valign: 'middle' },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
    theme: 'grid',
  });
  doc.text(title, 10, 15);
  doc.save(filename);
}
