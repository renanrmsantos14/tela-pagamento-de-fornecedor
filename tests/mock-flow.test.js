import test from "node:test";
import assert from "node:assert/strict";

async function client() {
  globalThis.window = {
    location: { hostname: "10.113.2.46", port: "5192" },
    parent: {},
    top: {},
  };
  return import(`../src/lib/dataverse.js?mock=${Date.now()}-${Math.random()}`);
}

test("lista de lançamento traz contexto operacional para precificar", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const service = (await dataverse.listFinanceServices()).find(
    (row) => row.status === "concluido",
  );
  assert.ok(service.dataServico);
  assert.ok(service.dataFinalizacao);
  assert.ok(service.trajeto);
  assert.ok(service.motorista);
  assert.ok(service.tipoVeiculo);
  assert.ok(service.observacaoOperacao);
});

test("fluxo local: repasse, vínculo, rascunho, pagamento, documento e auditoria", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const services = await dataverse.listFinanceServices();
  const target = services.find(
    (row) => row.status === "concluido" && row.valorRepasse === 0,
  );
  await dataverse.saveServiceRepasse(target.id, 800, target.etag);
  await dataverse.setPreferredFavorecido(target.id, favorecido.id);
  const refreshed = (await dataverse.listFinanceServices()).find(
    (row) => row.id === target.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [refreshed],
    year: 2026,
  });
  assert.equal(lot.paymentStatus, "open");
  assert.equal(
    (await dataverse.listFinanceServices()).find((row) => row.id === target.id)
      .pagamentoId,
    lot.id,
  );
  const paid = await dataverse.markPaid(lot.id);
  assert.equal(paid.paymentStatus, "paid");
  const upload = await dataverse.saveDocumentToOneDrive(paid, {
    name: "teste.pdf",
    base64: "AA==",
  });
  const email = await dataverse.sendEmailWithPdf(paid, {
    name: "teste.pdf",
    base64: "AA==",
  });
  await dataverse.registerDocumentResult(lot.id, {
    ok: true,
    url: upload.url,
    name: "teste.pdf",
    emailId: email.id,
  });
  const detail = await dataverse.getLotDetail(lot.id);
  assert.equal(detail.documentStatus, "sent");
  assert.ok(detail.events.length >= 3);
  assert.equal(detail.items[0].valorCobrado > 0, true);
});

test("cancelamento exige motivo e libera serviços", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const service = (await dataverse.listFinanceServices()).find(
    (row) =>
      row.status === "concluido" &&
      row.valorRepasse > 0 &&
      !row.pagamentoId &&
      row.favorecidoId === favorecido.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [service],
    year: 2026,
  });
  await assert.rejects(() => dataverse.cancelLot(lot.id, ""));
  await dataverse.cancelLot(lot.id, "Serviço duplicado");
  assert.equal(
    (await dataverse.listFinanceServices()).find((row) => row.id === service.id)
      .pagamentoId,
    "",
  );
});

test("falha documental mantém pagamento e reversão exige motivo", async () => {
  const { dataverse } = await client();
  dataverse.resetMock();
  const [favorecido] = await dataverse.listFavorecidos();
  const service = (await dataverse.listFinanceServices()).find(
    (row) =>
      row.status === "concluido" &&
      row.valorRepasse > 0 &&
      !row.pagamentoId &&
      row.favorecidoId === favorecido.id,
  );
  const lot = await dataverse.createDraftLot({
    favorecido,
    services: [service],
    year: 2026,
  });
  await dataverse.markPaid(lot.id);
  dataverse.setMockFailure("onedrive");
  await assert.rejects(() =>
    dataverse.saveDocumentToOneDrive(lot, { name: "x.pdf", base64: "AA==" }),
  );
  await dataverse.registerDocumentResult(lot.id, { ok: false, error: "falha" });
  assert.equal((await dataverse.getLotDetail(lot.id)).paymentStatus, "paid");
  await assert.rejects(() => dataverse.revertPaid(lot.id, ""));
  const reverted = await dataverse.revertPaid(lot.id, "PIX devolvido");
  assert.equal(reverted.paymentStatus, "open");
  assert.equal(reverted.documentStatus, "resend_required");
});
