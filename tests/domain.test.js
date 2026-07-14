import test from "node:test";
import assert from "node:assert/strict";
import { createLotSnapshot, eligibleServices, groupMonthly, paymentTotals, validateFavorecido } from "../src/domain/payment.js";

const services = [
  { id: "1", favorecidoId: "fav-1", status: "concluido", dataServico: "2026-01-10T10:00:00Z", valorCobrado: 1000, valorRepasse: 600 },
  { id: "2", favorecidoId: "fav-1", status: "concluido", dataServico: "2026-02-10T10:00:00Z", valorCobrado: 800, valorRepasse: 500 },
  { id: "3", favorecidoId: "fav-1", status: "pendente", dataServico: "2026-02-10T10:00:00Z", valorCobrado: 900, valorRepasse: 400 },
];

test("calcula total cobrado, repasse e margem separados", () => assert.deepEqual(paymentTotals(services), { revenue: 2700, repasse: 1500, margin: 1200, count: 3 }));
test("seleciona apenas concluídos sem lote", () => assert.equal(eligibleServices(services, "fav-1").length, 2));
test("agrega por mês sem perder meses vazios", () => assert.equal(groupMonthly(services, 2026)[1].count, 2));
test("valida dados mínimos do favorecido", () => assert.equal(Object.keys(validateFavorecido({})).length, 4));
test("congela snapshot do favorecido e dos serviços no lote", () => {
  const lot = createLotSnapshot({ id: "fav-1", nome: "João", documento: "123", chavePix: "abc" }, services.slice(0, 2), 2026);
  assert.equal(lot.services.length, 2);
  assert.equal(JSON.parse(lot.favorecidoSnapshot).nome, "João");
  assert.equal(lot.margin, 700);
});
