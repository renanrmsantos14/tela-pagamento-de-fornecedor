import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_STATUS,
  LOT_STATUS,
  PAYMENT_STATUS,
  createLotSnapshot,
  eligibleServices,
  isCpCompleted,
  isLegacyPaidService,
  marginPercent,
  paymentTotals,
  profit,
  repassePercent,
  serviceLotEligibilityReason,
  serviceLotWarnings,
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
test("torna elegível serviço com repasse e vínculo ativo", () =>
  assert.equal(eligibleServices(services, "f1", links).length, 2));
test("permite CP pendente e sinaliza seu status", () => {
  const service = { ...services[0], status: "pendente", statusLabel: "Pendente" };
  assert.equal(eligibleServices([service], "f1", links).length, 1);
  assert.equal(serviceLotEligibilityReason(service, "f1", links), "");
  assert.deepEqual(serviceLotWarnings(service).map((warning) => warning.code), ["CP_NOT_COMPLETED"]);
});
test("reconhece CP Concluída sem aviso", () => {
  const service = { ...services[0], statusLabel: "Concluída" };
  assert.equal(isCpCompleted(service), true);
  assert.deepEqual(serviceLotWarnings(service), []);
});
test("permite CP zerada com repasse e sinaliza prejuízo", () => {
  const service = {
    ...services[0],
    id: "zero-cp",
    valorCobrado: 0,
    valorRepasse: 50,
  };
  assert.equal(eligibleServices([service], "f1", links).length, 1);
  assert.deepEqual(
    serviceLotWarnings(service).map((warning) => warning.code),
    ["ZERO_CP", "NEGATIVE_MARGIN"],
  );
  assert.equal(serviceLotEligibilityReason(service, "f1", links), "");
});
test("mantém serviço com margem negativa elegível e sinalizado", () => {
  assert.equal(eligibleServices([services[1]], "f1", links).length, 1);
  assert.deepEqual(
    serviceLotWarnings(services[1]).map((warning) => warning.code),
    ["NEGATIVE_MARGIN"],
  );
});
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
test("status da reserva não altera elegibilidade ou aviso da CP", () => {
  const service = {
    ...services[0],
    status: "pendente",
    reservationStatus: "100000001",
    reservationStatusLabel: "Concluído",
  };
  assert.equal(eligibleServices([service], "f1", links).length, 1);
  assert.deepEqual(serviceLotWarnings(service).map((warning) => warning.code), ["CP_NOT_COMPLETED"]);
});
test("considera como pago o historico anterior a 01/06/2026", () => {
  const service = { ...services[2], dataServico: "2026-05-31T23:59:59Z" };
  assert.equal(isLegacyPaidService(service), true);
  assert.equal(eligibleServices([service], "", links).length, 0);
  assert.equal(
    serviceLotEligibilityReason(service, "", links),
    "Pagamento historico anterior a 01/06/2026",
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
