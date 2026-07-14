export const LOT_STATUS = Object.freeze({
  DRAFT: "draft",
  CANCELLED: "cancelled",
});
export const PAYMENT_STATUS = Object.freeze({ OPEN: "open", PAID: "paid" });
export const DOCUMENT_STATUS = Object.freeze({
  NOT_GENERATED: "not_generated",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  RESEND_REQUIRED: "resend_required",
});
export const ITEM_STATUS = Object.freeze({
  RESERVED: "reserved",
  PAID: "paid",
  CANCELLED: "cancelled",
});

export function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}
export function fromCents(value) {
  return Number(value || 0) / 100;
}
export function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}
export function moneyInput(value) {
  return fromCents(toCents(value)).toFixed(2).replace(".", ",");
}
export function parseMoney(value) {
  return (
    Number(
      String(value ?? "")
        .replace(/[^0-9,-]/g, "")
        .replace(",", "."),
    ) || 0
  );
}
export function profit(service) {
  return fromCents(
    toCents(service.valorCobrado) - toCents(service.valorRepasse),
  );
}
export function marginPercent(service) {
  const revenue = toCents(service.valorCobrado);
  return revenue ? (toCents(profit(service)) / revenue) * 100 : 0;
}

export function paymentTotals(items) {
  const revenueCents = items.reduce(
    (total, item) => total + toCents(item.valorCobrado),
    0,
  );
  const repasseCents = items.reduce(
    (total, item) => total + toCents(item.valorRepasse),
    0,
  );
  const marginCents = revenueCents - repasseCents;
  return {
    revenue: fromCents(revenueCents),
    repasse: fromCents(repasseCents),
    margin: fromCents(marginCents),
    marginPercent: revenueCents ? (marginCents / revenueCents) * 100 : 0,
    count: items.length,
  };
}

export function isEligibleService(service, favorecidoId, activeLinks = []) {
  if (
    service.status !== "concluido" ||
    toCents(service.valorCobrado) <= 0 ||
    toCents(service.valorRepasse) <= 0 ||
    service.pagamentoId
  )
    return false;
  if (!favorecidoId) return true;
  return activeLinks.some(
    (link) =>
      link.status === "ativo" &&
      link.motoristaId === service.motoristaId &&
      link.favorecidoId === favorecidoId,
  );
}

export function eligibleServices(
  services,
  favorecidoId = "",
  activeLinks = [],
) {
  return services.filter((service) =>
    isEligibleService(service, favorecidoId, activeLinks),
  );
}

export function groupMonthly(services, year) {
  const rows = Array.from({ length: 12 }, (_, month) => ({
    month,
    revenue: 0,
    repasse: 0,
    margin: 0,
    count: 0,
  }));
  services.forEach((service) => {
    const date = new Date(service.dataServico);
    if (date.getFullYear() !== Number(year)) return;
    const row = rows[date.getMonth()];
    const totals = paymentTotals([service]);
    row.revenue += totals.revenue;
    row.repasse += totals.repasse;
    row.margin += totals.margin;
    row.count += 1;
  });
  return rows;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}
function repeated(value) {
  return /^(\d)\1+$/.test(value);
}
function validCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || repeated(cpf)) return false;
  const digit = (length) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce(
        (total, char, index) => total + Number(char) * (length + 1 - index),
        0,
      );
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
function validCnpj(value) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || repeated(cnpj)) return false;
  const check = (base) => {
    let factor = base.length - 7;
    const sum = base.split("").reduce((total, char) => {
      const next = total + Number(char) * factor;
      factor = factor === 2 ? 9 : factor - 1;
      return next;
    }, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return (
    check(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    check(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}

export function validateFavorecido(form) {
  const errors = {};
  const document = digits(form.documento);
  if (!String(form.nome || "").trim())
    errors.nome = "Informe o nome ou razão social.";
  if (!document) errors.documento = "Informe CPF ou CNPJ.";
  else if (
    form.tipoPessoa === "PF" ? !validCpf(document) : !validCnpj(document)
  )
    errors.documento = "CPF/CNPJ inválido.";
  const pix = String(form.chavePix || "").trim();
  if (!pix) errors.chavePix = "Informe a chave PIX.";
  else if (
    form.tipoChavePix === "E-mail" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pix)
  )
    errors.chavePix = "Informe uma chave PIX de e-mail válida.";
  else if (form.tipoChavePix === "Telefone" && digits(pix).length < 10)
    errors.chavePix = "Informe uma chave PIX de telefone válida.";
  else if (
    form.tipoChavePix === "CPF/CNPJ" &&
    !(validCpf(pix) || validCnpj(pix))
  )
    errors.chavePix = "Informe uma chave PIX CPF/CNPJ válida.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email || "")))
    errors.email = "Informe um e-mail válido.";
  return errors;
}

export function createLotSnapshot(
  favorecido,
  services,
  year = new Date().getFullYear(),
) {
  const totals = paymentTotals(services);
  return {
    lotStatus: LOT_STATUS.DRAFT,
    paymentStatus: PAYMENT_STATUS.OPEN,
    documentStatus: DOCUMENT_STATUS.NOT_GENERATED,
    version: 1,
    year,
    favorecidoId: favorecido.id,
    favorecidoSnapshot: JSON.stringify(favorecido),
    services: services.map((service) => ({
      ...service,
      itemStatus: ITEM_STATUS.RESERVED,
    })),
    ...totals,
  };
}

export function canCancel(lot) {
  return (
    lot.lotStatus === LOT_STATUS.DRAFT &&
    lot.paymentStatus === PAYMENT_STATUS.OPEN
  );
}
export function canPay(lot) {
  return (
    lot.lotStatus === LOT_STATUS.DRAFT &&
    lot.paymentStatus === PAYMENT_STATUS.OPEN
  );
}
export function canRevert(lot) {
  return (
    lot.lotStatus === LOT_STATUS.DRAFT &&
    lot.paymentStatus === PAYMENT_STATUS.PAID
  );
}
