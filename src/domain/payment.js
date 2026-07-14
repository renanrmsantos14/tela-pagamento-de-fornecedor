export const PAYMENT_STATUS = Object.freeze({
  DRAFT: 100000000,
  SEND_FAILED: 100000001,
  AWAITING: 100000002,
  PAID: 100000003,
});

export const ITEM_STATUS = Object.freeze({ RESERVED: 100000000, PAID: 100000001, CANCELLED: 100000002 });

export function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export function sumBy(items, field) {
  return items.reduce((total, item) => total + Number(item?.[field] || 0), 0);
}

export function paymentTotals(services) {
  const revenue = sumBy(services, "valorCobrado");
  const repasse = sumBy(services, "valorRepasse");
  return { revenue, repasse, margin: revenue - repasse, count: services.length };
}

export function eligibleServices(services, favorecidoId) {
  return services.filter((service) => service.status === "concluido" && Number(service.valorCobrado || 0) > 0 && Number(service.valorRepasse || 0) > 0 && !service.pagamentoId && (!favorecidoId || service.favorecidoId === favorecidoId));
}

export function groupMonthly(services, year) {
  const rows = Array.from({ length: 12 }, (_, month) => ({ month, revenue: 0, repasse: 0, margin: 0, count: 0 }));
  services.forEach((service) => {
    const date = new Date(service.dataServico);
    if (date.getFullYear() !== Number(year)) return;
    const row = rows[date.getMonth()];
    row.revenue += Number(service.valorCobrado || 0);
    row.repasse += Number(service.valorRepasse || 0);
    row.margin += Number(service.valorCobrado || 0) - Number(service.valorRepasse || 0);
    row.count += 1;
  });
  return rows;
}

export function validateFavorecido(form) {
  const errors = {};
  if (!String(form.nome || "").trim()) errors.nome = "Informe o nome ou razão social.";
  if (!String(form.documento || "").trim()) errors.documento = "Informe CPF ou CNPJ.";
  if (!String(form.chavePix || "").trim()) errors.chavePix = "Informe a chave PIX.";
  if (!String(form.email || "").includes("@")) errors.email = "Informe um e-mail válido.";
  return errors;
}

export function createLotSnapshot(favorecido, services, year = new Date().getFullYear()) {
  const totals = paymentTotals(services);
  return {
    status: PAYMENT_STATUS.DRAFT,
    version: 1,
    year,
    favorecidoId: favorecido.id,
    favorecidoSnapshot: JSON.stringify(favorecido),
    services: services.map((service) => ({ ...service, status: "reservado", favorecidoId: favorecido.id })),
    ...totals,
  };
}
