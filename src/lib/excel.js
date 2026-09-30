import { zipSync } from "fflate";

const encoder = new TextEncoder();
const MAX_ROWS_PER_SHEET = 1048571;
const escapeXml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const columnLetter = (index) => {
  let number = index + 1;
  let result = "";
  while (number) {
    number -= 1;
    result = String.fromCharCode(65 + number % 26) + result;
    number = Math.floor(number / 26);
  }
  return result;
};
const textCell = (address, value, style) => `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
const numberCell = (address, value, style) => `<c r="${address}" s="${style}"><v>${value}</v></c>`;
const excelDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getTime() - date.getTimezoneOffset() * 60000) / 86400000 + 25569;
};
const serviceValue = (service, id, favorecidos) => {
  if (id === "statusCp") return service.statusLabel || "Status da CP não informado";
  if (id === "statusReserva") return service.reservationStatusLabel || "Não informado";
  if (id === "favorecido") return favorecidos.get(service.favorecidoId) || "Não informado";
  return service[id] ?? "";
};
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Aptos"/><color rgb="FF243448"/></font><font><b/><sz val="17"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142C49"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F6FA"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const worksheet = (services, columns, favorecidos, viewName, part, totalParts) => {
  const lastColumn = columnLetter(columns.length - 1);
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  const subtitle = `${viewName || "Layout atual"}  •  ${services.length} serviço(s)  •  Filtros da tela aplicados${totalParts > 1 ? `  •  Parte ${part}/${totalParts}` : ""}`;
  const rows = [
    `<row r="1" ht="32" customHeight="1">${textCell("A1", "PAGAMENTO DE FORNECEDORES | REPASSES", 1)}</row>`,
    `<row r="2" ht="24" customHeight="1">${textCell("A2", subtitle, 2)}</row>`,
    `<row r="3" ht="22" customHeight="1">${textCell("A3", `Extraído em ${generatedAt}`, 4)}</row>`,
    `<row r="5" ht="28" customHeight="1">${columns.map((column, index) => textCell(`${columnLetter(index)}5`, column.label, 3)).join("")}</row>`,
  ];
  services.forEach((service, index) => {
    const rowNumber = index + 6;
    const shaded = index % 2 === 1;
    const cells = columns.map((column, columnIndex) => {
      const address = `${columnLetter(columnIndex)}${rowNumber}`;
      const value = serviceValue(service, column.id, favorecidos);
      if (column.id === "valorCobrado" || column.id === "valorRepasse") {
        const amount = Number(value);
        return numberCell(address, Number.isFinite(amount) ? amount : 0, shaded ? 7 : 6);
      }
      if (column.id === "dataServico" || column.id === "dataFinalizacao") {
        const date = excelDate(value);
        return date === null ? textCell(address, "", shaded ? 5 : 4) : numberCell(address, date, shaded ? 9 : 8);
      }
      return textCell(address, value, shaded ? 5 : 4);
    }).join("");
    rows.push(`<row r="${rowNumber}" ht="21" customHeight="1">${cells}</row>`);
  });
  const lastRow = services.length + 5;
  const widths = columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(45, Math.max(15, Math.ceil((column.width || 160) / 7)))}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths}</cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="A5:${lastColumn}${lastRow}"/><mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
};

export function buildServicesXlsx(services, columns, favorecidos, viewName = "") {
  if (!columns.length) throw new Error("Selecione ao menos uma coluna para extrair.");
  const parts = Math.max(1, Math.ceil(services.length / MAX_ROWS_PER_SHEET));
  const favorecidoById = new Map(favorecidos.map((row) => [row.id, row.nome]));
  const files = {
    "_rels/.rels": encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/styles.xml": encoder.encode(styles),
  };
  const sheets = [];
  const relationships = [`<Relationship Id="rId${parts + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`];
  const overrides = [`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`, `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`];
  for (let part = 1; part <= parts; part += 1) {
    const name = parts === 1 ? "Repasses" : `Repasses ${part}`;
    const file = `sheet${part}.xml`;
    files[`xl/worksheets/${file}`] = encoder.encode(worksheet(services.slice((part - 1) * MAX_ROWS_PER_SHEET, part * MAX_ROWS_PER_SHEET), columns, favorecidoById, viewName, part, parts));
    sheets.push(`<sheet name="${name}" sheetId="${part}" r:id="rId${part}"/>`);
    relationships.push(`<Relationship Id="rId${part}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${file}"/>`);
    overrides.push(`<Override PartName="/xl/worksheets/${file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  }
  files["xl/workbook.xml"] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.join("")}</sheets></workbook>`);
  files["xl/_rels/workbook.xml.rels"] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`);
  files["[Content_Types].xml"] = encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join("")}</Types>`);
  return zipSync(files, { level: 6 });
}

export function downloadServicesXlsx(services, columns, favorecidos, viewName) {
  const bytes = buildServicesXlsx(services, columns, favorecidos, viewName);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `repasses-${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
