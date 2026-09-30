import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";
import { buildServicesXlsx } from "../src/lib/excel.js";

const readSheet = (bytes) => {
  const files = unzipSync(bytes);
  return {
    files,
    sheet: new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]),
    styles: new TextDecoder().decode(files["xl/styles.xml"]),
  };
};

test("xlsx contém todas as linhas, ordem da view e recursos de leitura", () => {
  const rows = Array.from({ length: 125 }, (_, index) => ({
    identificador: `SRV-${index + 1}`,
    valorRepasse: index - 0.5,
  }));
  const { files, sheet, styles } = readSheet(buildServicesXlsx(rows, [
    { id: "identificador", label: "Serviço", width: 150 },
    { id: "valorRepasse", label: "Repasse", width: 140 },
  ], [], "Pendentes"));
  assert.ok(files["xl/workbook.xml"]);
  assert.match(sheet, /<dimension ref="A1:B130"/);
  assert.match(sheet, /<autoFilter ref="A5:B130"/);
  assert.ok(sheet.indexOf("<autoFilter ") < sheet.indexOf("<mergeCells "));
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /<c r="A6"[^>]*>.*SRV-1.*<\/c>/);
  assert.match(sheet, /<c r="B6" s="6"><v>-0\.5<\/v><\/c>/);
  assert.match(sheet, /<c r="A130"[^>]*>.*SRV-125.*<\/c>/);
  assert.match(sheet, /Pendentes.*125 serviço\(s\)/);
  assert.match(styles, /numFmtId="164"/);
});

test("texto é seguro, acentos preservados e datas viram células de data", () => {
  const { sheet } = readSheet(buildServicesXlsx([{
    cliente: '=HYPERLINK("x") & João',
    dataServico: "2026-09-24T12:30:00Z",
  }], [
    { id: "cliente", label: "Cliente" },
    { id: "dataServico", label: "Data" },
  ], []));
  assert.match(sheet, /t="inlineStr".*=HYPERLINK\(&quot;x&quot;\) &amp; João/);
  assert.match(sheet, /<c r="B6" s="8"><v>\d+\.\d+<\/v><\/c>/);
  assert.doesNotMatch(sheet, /<f>/);
});
