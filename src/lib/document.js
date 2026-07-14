import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "../domain/payment";

const safe = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

export function buildPaymentPdf(lot, items) {
  const favorecido =
    lot.favorecido || JSON.parse(lot.favorecidoSnapshot || "{}");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFillColor(0, 32, 72);
  pdf.rect(0, 0, 210, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text("Betinhos Executive Service", 14, 14);
  pdf.setFontSize(9);
  pdf.text("Demonstrativo de pagamento a terceiro", 14, 21);
  pdf.setTextColor(23, 38, 59);
  pdf.setFontSize(13);
  pdf.text(`Lote ${lot.identifier} · versão ${lot.version}`, 14, 39);
  pdf.setFontSize(9);
  pdf.setTextColor(82, 97, 116);
  pdf.text(`Emissão: ${new Date().toLocaleString("pt-BR")}`, 14, 46);
  pdf.text(
    `Pagamento: ${lot.paidAt ? new Date(lot.paidAt).toLocaleString("pt-BR") : "Em aberto"}`,
    14,
    51,
  );
  pdf.setTextColor(23, 38, 59);
  pdf.setFontSize(10);
  pdf.text("Favorecido", 14, 63);
  pdf.setFontSize(9);
  pdf.text(
    [
      favorecido.nome || "",
      `CPF/CNPJ: ${favorecido.documento || ""}`,
      `PIX ${favorecido.tipoChavePix || ""}: ${favorecido.chavePix || ""}`,
    ],
    14,
    69,
  );
  autoTable(pdf, {
    startY: 88,
    head: [["Serviço", "Data", "Motorista", "Trajeto", "Repasse"]],
    body: items.map((item) => [
      item.identificador,
      item.dataServico
        ? new Date(item.dataServico).toLocaleDateString("pt-BR")
        : "",
      item.motorista,
      item.trajeto,
      money(item.valorRepasse),
    ]),
    theme: "grid",
    headStyles: { fillColor: [0, 32, 72] },
    styles: { fontSize: 8, cellPadding: 2.4 },
    columnStyles: { 3: { cellWidth: 56 }, 4: { halign: "right" } },
  });
  const endY = pdf.lastAutoTable.finalY + 10;
  pdf.setFillColor(237, 243, 255);
  pdf.roundedRect(14, endY, 182, 19, 3, 3, "F");
  pdf.setTextColor(23, 38, 59);
  pdf.setFontSize(9);
  pdf.text(`Quantidade de serviços: ${items.length}`, 20, endY + 8);
  pdf.setFontSize(12);
  pdf.text(`Total do repasse: ${money(lot.repasse)}`, 20, endY + 15);
  pdf.setFontSize(8);
  pdf.setTextColor(103, 116, 135);
  pdf.text(
    "Documento financeiro destinado exclusivamente ao Terceiro Favorecido.",
    14,
    286,
  );
  const name = `Pagamento_${safe(lot.identifier)}_v${lot.version}.pdf`;
  const dataUri = pdf.output("datauristring");
  return { name, base64: dataUri.split(",")[1], dataUri };
}
