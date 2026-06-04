// Invoice & CSV helpers — client-side, no backend needed.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type InvoiceOrder = {
  order_number: number | null | undefined;
  imei: string;
  status: string;
  price_charged: number;
  result: string | null;
  error_message: string | null;
  created_at: string;
  services: { name: string; category?: string | null } | null;
};

export type InvoiceBrand = {
  brand_name: string;
  tagline?: string | null;
  logo_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
};

export type InvoiceCustomer = {
  display_name?: string | null;
  email?: string | null;
};

function stripMarkers(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replace(/\[\[c:[^\]]+\]\]/g, "").replace(/\[\[\/c\]\]/g, "");
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildOrderInvoice(
  order: InvoiceOrder,
  brand: InvoiceBrand,
  customer: InvoiceCustomer,
): Promise<{ blob: Blob; url: string; filename: string }> {

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Logo (enlarged; brand name/tagline omitted next to it)
  let logoRendered = false;
  if (brand.logo_url) {
    const dataUrl = await loadImageAsDataUrl(brand.logo_url);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", margin, y, 180, 60);
        logoRendered = true;
      } catch { /* ignore */ }
    }
  }
  if (!logoRendered) {
    // Fallback to brand name if logo can't load
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(brand.brand_name, margin, y + 30);
  }

  // Invoice title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text("INVOICE", pageW - margin, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const orderId = `#${String(order.order_number ?? 0).padStart(4, "0")}`;
  doc.text(`Order ${orderId}`, pageW - margin, y + 34, { align: "right" });
  doc.text(new Date(order.created_at).toLocaleString(), pageW - margin, y + 48, { align: "right" });

  y += 80;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // From / Bill to
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text("FROM", margin, y);
  doc.text("BILL TO", pageW / 2, y);
  doc.setTextColor(30);
  doc.setFontSize(10);
  let yL = y + 14;
  doc.text(brand.brand_name, margin, yL);
  if (brand.contact_email) { yL += 12; doc.text(brand.contact_email, margin, yL); }
  if (brand.contact_phone) { yL += 12; doc.text(brand.contact_phone, margin, yL); }
  if (brand.address) { yL += 12; doc.text(doc.splitTextToSize(brand.address, pageW / 2 - margin - 10), margin, yL); }

  let yR = y + 14;
  doc.text(customer.display_name || customer.email || "Customer", pageW / 2, yR);
  if (customer.email && customer.display_name) { yR += 12; doc.text(customer.email, pageW / 2, yR); }

  y = Math.max(yL, yR) + 24;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["Service", "IMEI / SN", "Status", "Amount"]],
    body: [[
      order.services?.name ?? "—",
      order.imei,
      order.status.toUpperCase(),
      `$${Number(order.price_charged).toFixed(2)}`,
    ]],
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    columnStyles: { 3: { halign: "right" } },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error autotable adds this
  y = (doc.lastAutoTable?.finalY ?? y) + 14;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", pageW - margin - 100, y + 14);
  doc.text(`$${Number(order.price_charged).toFixed(2)}`, pageW - margin, y + 14, { align: "right" });
  y += 36;

  // Result / error
  const resultText = stripMarkers(order.result) || stripMarkers(order.error_message);
  if (resultText) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text("Result", margin, y);
    y += 12;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(resultText.slice(0, 4000), pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 11 + 10;
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated ${new Date().toLocaleString()} — ${brand.brand_name}`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 24,
    { align: "center" },
  );

  const filename = `invoice-${orderId.replace("#", "")}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { blob, url, filename };
}

export async function downloadOrderInvoice(
  order: InvoiceOrder,
  brand: InvoiceBrand,
  customer: InvoiceCustomer,
) {
  const { url, filename } = await buildOrderInvoice(order, brand, customer);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportOrdersCsv(rows: InvoiceOrder[], filename = "orders.csv") {
  const headers = ["order_number", "service", "imei", "status", "price", "date", "result"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((o) => [
      `#${String(o.order_number ?? 0).padStart(4, "0")}`,
      o.services?.name ?? "",
      o.imei,
      o.status,
      Number(o.price_charged).toFixed(2),
      new Date(o.created_at).toISOString(),
      stripMarkers(o.result) || stripMarkers(o.error_message),
    ].map(escape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportRowsCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
