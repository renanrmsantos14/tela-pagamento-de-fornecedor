import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoBetinhos from "../assets/logo-betinhos-b.png?inline";
import { money } from "../domain/payment";

const BRAND = {
  navy: [0, 31, 67],
  navySoft: [16, 47, 83],
  gold: [205, 166, 93],
  goldLight: [244, 234, 209],
  ink: [21, 35, 53],
  muted: [97, 112, 132],
  line: [224, 229, 235],
  surface: [252, 252, 251],
};

const safe = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

const dateTime = (value, fallback = "-") => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString("pt-BR")
    : fallback;
};

const dateOnly = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("pt-BR")
    : "-";
};

const drawLabel = (pdf, label, value, x, y, width) => {
  pdf.setTextColor(...BRAND.muted);
  pdf.setFontSize(7.4);
  pdf.setFont("helvetica", "bold");
  pdf.text(label.toUpperCase(), x, y);
  pdf.setTextColor(...BRAND.ink);
  pdf.setFontSize(9.2);
  pdf.setFont("helvetica", "normal");
  const lines = pdf.splitTextToSize(String(value || "-"), width);
  pdf.text(lines.slice(0, 2), x, y + 5);
};

const addFooter = (pdf) => {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BRAND.line);
    pdf.line(14, 286, 196, 286);
    pdf.setTextColor(...BRAND.muted);
    pdf.setFontSize(7.3);
    pdf.setFont("helvetica", "normal");
    pdf.text("BETINHOS EXECUTIVE SERVICE  |  Documento financeiro", 14, 291);
    pdf.text(`Pagina ${page} de ${pages}`, 196, 291, { align: "right" });
  }
};

export function buildPaymentPdf(lot, items) {
  const favorecido = lot.favorecido || JSON.parse(lot.favorecidoSnapshot || "{}");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  pdf.setFillColor(...BRAND.surface);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setFillColor(...BRAND.navy);
  pdf.rect(0, 0, 210, 39, "F");
  pdf.setFillColor(...BRAND.gold);
  pdf.rect(0, 37, 210, 2, "F");
  pdf.addImage(logoBetinhos, "PNG", 14, 7, 23, 23);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("BETINHOS", 42, 17);
  pdf.setTextColor(...BRAND.goldLight);
  pdf.setFontSize(6.8);
  pdf.setFont("helvetica", "normal");
  pdf.setCharSpace(0.55);
  pdf.text("EXECUTIVE SERVICE", 42, 23);
  pdf.setCharSpace(0);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.6);
  pdf.text("DEMONSTRATIVO DE PAGAMENTO", 196, 15, { align: "right" });
  pdf.setTextColor(...BRAND.goldLight);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`LOTE ${lot.identifier}  |  VERSAO ${lot.version}`, 196, 21, {
    align: "right",
  });

  pdf.setTextColor(...BRAND.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Resumo do repasse", 14, 53);
  pdf.setTextColor(...BRAND.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.7);
  pdf.text("Informacoes consolidadas para conferencia do favorecido.", 14, 59);

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...BRAND.line);
  pdf.roundedRect(14, 66, 182, 39, 3, 3, "FD");
  drawLabel(pdf, "Favorecido", favorecido.nome, 20, 75, 74);
  drawLabel(pdf, "CPF / CNPJ", favorecido.documento, 20, 91, 74);
  drawLabel(
    pdf,
    "Chave PIX",
    [favorecido.tipoChavePix, favorecido.chavePix].filter(Boolean).join(": "),
    104,
    75,
    82,
  );
  drawLabel(pdf, "Pagamento", lot.paidAt ? dateTime(lot.paidAt) : "Em aberto", 104, 91, 82);

  pdf.setFillColor(...BRAND.goldLight);
  pdf.roundedRect(14, 112, 182, 17, 3, 3, "F");
  pdf.setTextColor(...BRAND.navy);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.2);
  pdf.text("TOTAL DO REPASSE", 20, 119);
  pdf.setFontSize(15);
  pdf.text(money(lot.repasse), 190, 122, { align: "right" });
  pdf.setTextColor(...BRAND.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`${items.length} servico(s) incluido(s)  |  Emissao: ${dateTime(new Date())}`, 20, 125);

  autoTable(pdf, {
    startY: 137,
    margin: { left: 14, right: 14, bottom: 22 },
    head: [["Servico", "Data", "Motorista", "Trajeto", "Repasse"]],
    body: items.map((item) => [
      item.identificador || "-",
      dateOnly(item.dataServico),
      item.motorista || "-",
      item.trajeto || "-",
      money(item.valorRepasse),
    ]),
    theme: "plain",
    headStyles: {
      fillColor: BRAND.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.7,
      cellPadding: 3,
    },
    bodyStyles: {
      textColor: BRAND.ink,
      fontSize: 8,
      cellPadding: 3,
      lineColor: BRAND.line,
      lineWidth: { bottom: 0.25 },
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: "bold" },
      1: { cellWidth: 22 },
      2: { cellWidth: 34 },
      3: { cellWidth: 67 },
      4: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
  });

  addFooter(pdf);
  const name = `Pagamento_${safe(lot.identifier)}_v${lot.version}.pdf`;
  const dataUri = pdf.output("datauristring");
  return { name, base64: dataUri.split(",")[1], dataUri };
}
