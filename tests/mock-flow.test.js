import test from "node:test";
import assert from "node:assert/strict";
import { paymentTotals } from "../src/domain/payment.js";

test("executa o fluxo local completo: reservar, enviar, pagar e auditar", async () => {
  globalThis.window = { location: { hostname: "10.113.2.46", port: "5192" }, parent: {}, top: {} };
  const { dataverse, TABLES } = await import(`../src/lib/dataverse.js?mock=${Date.now()}`);
  assert.equal(dataverse.mockMode, true);
  const favorecidos = await dataverse.listFavorecidos();
  const services = (await dataverse.listServices()).filter((service) => service.status === "concluido" && service.valorRepasse > 0 && !service.pagamentoId).slice(0, 6);
  assert.ok(favorecidos.length >= 5);
  assert.ok(services.length >= 6);
  const totals = paymentTotals(services);
  const lot = await dataverse.createPayment({ year: 2026, favorecidoId: services[0].favorecidoId, favorecido: favorecidos.find((row) => row.id === services[0].favorecidoId), favorecidoSnapshot: JSON.stringify(favorecidos[0]), services, revenue: totals.revenue, repasse: totals.repasse, margin: totals.margin });
  assert.equal(lot.status, 100000000);
  assert.equal((await dataverse.listAll(TABLES.item)).filter((item) => item.paymentId === lot.id).length, services.length);
  await dataverse.sendPayment(lot);
  assert.equal((await dataverse.listAll(TABLES.payment)).find((row) => row.id === lot.id).status, 100000002);
  await dataverse.markPaid(lot, "https://onedrive.local/comprovante.pdf");
  assert.equal((await dataverse.listAll(TABLES.payment)).find((row) => row.id === lot.id).status, 100000003);
  assert.ok((await dataverse.listAll(TABLES.event)).filter((event) => event.paymentId === lot.id).length >= 3);
  assert.equal((await dataverse.listServices()).filter((service) => service.pagamentoId === lot.id).length, services.length);
});
