import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_STATUS,
  LOT_STATUS,
  PAYMENT_STATUS,
  createLotSnapshot,
  eligibleServices,
  isLegacyPaidService,
  marginPercent,
  paymentTotals,
  profit,
  repassePercent,
  serviceLotEligibilityReason,
  toCents,
  validateFavorecido,
} from "../src/domain/payment.js";

const services = [
  {
    id: "1",
    motoristaId: "m1",
    favorecidoId: "f1",
    status: "concluido",
    valorCobrado: 1000,
    valorRepasse: 600,
  },
  {
    id: "2",
    motoristaId: "m2",
    favorecidoId: "f1",
    status: "concluido",
    valorCobrado: 800,
    valorRepasse: 900,
  },
  {
    id: "3",
    motoristaId: "m1",
    favorecidoId: "",
    status: "concluido",
    valorCobrado: 900,
    valorRepasse: 0,
  },
];
const links = [
  { motoristaId: "m1", favorecidoId: "f1", status: "ativo" },
  { motoristaId: "m2", favorecidoId: "f1", status: "ativo" },
];

test("calcula em centavos sem erro de ponto flutuante", () =>
  assert.equal(toCents(0.1) + toCents(0.2), 30));
test("calcula lucro e margem negativa sem bloquear", () => {
  assert.equal(profit(services[1]), -100);
  assert.equal(marginPercent(services[1]), -12.5);
});
test("calcula percentual do repasse sobre a diferença do Total CP", () =>
  assert.equal(repassePercent({ valorCobrado: 1200, valorRepasse: 1000 }), 20));
test("soma receita, repasse, lucro e percentual", () =>
  assert.deepEqual(paymentTotals(services.slice(0, 2)), {
    revenue: 1800,
    repasse: 1500,
    margin: 300,
    marginPercent: 16.666666666666664,
    count: 2,
  }));
test("só torna elegível serviço concluído com repasse e vínculo ativo", () =>
  assert.equal(eligibleServices(services, "f1", links).length, 2));
test("usa indice de vinculos ativos sem percorrer a lista por servico", () => {
  const activeLinks = new Set(["m1:f1", "m2:f1"]);
  assert.equal(eligibleServices(services, "f1", activeLinks).length, 2);
  assert.equal(serviceLotEligibilityReason(services[0], "f1", activeLinks), "");
});
test("explica motivo de inelegibilidade para lote", () => {
  assert.equal(
    serviceLotEligibilityReason(services[2], "f1", links),
    "Repasse ainda não lançado ou igual a R$ 0,00",
  );
  assert.equal(
    serviceLotEligibilityReason(services[0], "f2", links),
    "Não existe vínculo ativo entre motorista e favorecido",
  );
});
test("usa status concluído da reserva na elegibilidade", () => {
  const service = {
    ...services[0],
    status: "pendente",
    reservationStatus: "100000001",
    reservationStatusLabel: "Concluído",
  };
  assert.equal(eligibleServices([service], "f1", links).length, 1);
});
test("considera como pago o historico anterior a 01/07/2026", () => {
  const service = { ...services[2], dataServico: "2026-06-30T23:59:59Z" };
  assert.equal(isLegacyPaidService(service), true);
  assert.equal(eligibleServices([service], "", links).length, 0);
  assert.equal(
    serviceLotEligibilityReason(service, "", links),
    "Pagamento historico anterior a 01/07/2026",
  );
});
test("snapshot inicia rascunho com pagamento aberto e documento pendente", () => {
  const lot = createLotSnapshot(
    { id: "f1", nome: "Terceiro" },
    services.slice(0, 1),
    2026,
  );
  assert.equal(lot.lotStatus, LOT_STATUS.DRAFT);
  assert.equal(lot.paymentStatus, PAYMENT_STATUS.OPEN);
  assert.equal(lot.documentStatus, DOCUMENT_STATUS.NOT_GENERATED);
});
test("valida CPF, PIX e e-mail antes de ativar favorecido", () => {
  const valid = validateFavorecido({
    nome: "Carlos",
    tipoPessoa: "PF",
    documento: "529.982.247-25",
    tipoChavePix: "CPF/CNPJ",
    chavePix: "529.982.247-25",
    email: "carlos@teste.com",
  });
  assert.equal(Object.keys(valid).length, 0);
  assert.ok(
    validateFavorecido({
      nome: "Carlos",
      tipoPessoa: "PF",
      documento: "111.111.111-11",
      tipoChavePix: "CPF/CNPJ",
      chavePix: "111",
      email: "x",
    }).documento,
  );
});
