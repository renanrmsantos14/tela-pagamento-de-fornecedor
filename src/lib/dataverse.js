const API_VERSION = "v9.2";
const FLOW_CONTRACT = "new_FlowURLFlowSalvarArquivosOnedrive";

export const TABLES = Object.freeze({
  employee: "cr40f_funcionarios",
  composition: "cr40f_composicaodeprecos",
  reservation: "cr40f_reservadeveiculos",
  favorecido: "cr40f_terceirofavorecido",
  link: "cr40f_vinculomotoristafavorecido",
  payment: "cr40f_pagamentoaterceiro",
  item: "cr40f_itempagamentoaterceiro",
  event: "cr40f_eventopagamentoaterceiro",
});

export const CHOICES = Object.freeze({ completedComposition: 100000001, activeEmployee: 0, activeFavorecido: 100000000 });

function cleanGuid(value) { return String(value || "").replace(/[{}]/g, ""); }
function localHost() { return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname); }
function localPreviewHost() { return localHost() || (typeof window !== "undefined" && window.location.port === "5192") || import.meta.env?.DEV === true; }
function getXrm() { return typeof window === "undefined" ? null : window.Xrm || window.parent?.Xrm || window.top?.Xrm || null; }
function escapeOData(value) { return String(value).replace(/'/g, "''"); }
function newId(prefix) { return `${prefix}-${crypto.randomUUID()}`; }

const mockFavorecidos = [
  { id: "fav-001", nome: "Alfa Transporte Executivo Ltda.", tipoPessoa: "PJ", documento: "12.345.678/0001-90", tipoChavePix: "CNPJ", chavePix: "12.345.678/0001-90", email: "financeiro@alfatransporte.com.br", status: "ativo" },
  { id: "fav-002", nome: "Carlos Henrique Souza", tipoPessoa: "PF", documento: "123.456.789-00", tipoChavePix: "CPF", chavePix: "123.456.789-00", email: "carlos.souza@email.com", status: "ativo" },
  { id: "fav-003", nome: "Beta Mobilidade Corporativa", tipoPessoa: "PJ", documento: "45.678.901/0001-22", tipoChavePix: "CNPJ", chavePix: "45.678.901/0001-22", email: "contas@betamobilidade.com.br", status: "ativo" },
  { id: "fav-004", nome: "Fernanda Alves", tipoPessoa: "PF", documento: "987.654.321-00", tipoChavePix: "E-mail", chavePix: "fernanda.alves@email.com", email: "fernanda.alves@email.com", status: "ativo" },
  { id: "fav-005", nome: "Gamma Eventos e Logistica", tipoPessoa: "PJ", documento: "78.901.234/0001-33", tipoChavePix: "CNPJ", chavePix: "78.901.234/0001-33", email: "financeiro@gammaeventos.com.br", status: "ativo" },
];

function buildMockServices() {
  const drivers = ["Carlos Henrique", "Marcos Lima", "Fernanda Alves", "Rafael Costa", "Juliana Prado"];
  const routes = ["GRU -> Faria Lima", "Congonhas -> Campinas", "Paulista -> Guarulhos", "Jundiai -> GRU", "Moema -> Santos", "Barra Funda -> Sorocaba"];
  return Array.from({ length: 96 }, (_, index) => {
    const favorecido = mockFavorecidos[index % mockFavorecidos.length];
    const valorCobrado = 780 + ((index * 137) % 1900);
    const missingRepasse = index > 0 && index % 23 === 0;
    return {
      id: `srv-${String(index + 1).padStart(4, "0")}`,
      identificador: `SRV-2026-${String(index + 184).padStart(4, "0")}`,
      dataServico: new Date(Date.UTC(2026, index % 12, 3 + (index % 24), 15)).toISOString(),
      cliente: ["Diretoria Acme", "Grupo Horizonte", "Nucleo Financeiro", "Alfa Eventos", "Operacao Sul"][index % 5],
      trajeto: routes[index % routes.length], motorista: drivers[index % drivers.length], motoristaId: `mot-${String((index % drivers.length) + 1).padStart(3, "0")}`,
      favorecidoId: favorecido.id, valorCobrado, valorRepasse: missingRepasse ? 0 : Math.round(valorCobrado * (0.49 + (index % 8) / 100)), status: index % 19 === 0 ? "pendente" : "concluido",
    };
  });
}

function buildMockState() {
  const services = buildMockServices();
  const reserved = services.filter((service) => service.status === "concluido" && service.valorRepasse > 0).slice(0, 2);
  const favorecido = mockFavorecidos.find((row) => row.id === reserved[0].favorecidoId);
  const lot = { id: "lot-demo-001", identifier: "PT-2026-000001", status: 100000002, version: 1, year: 2026, favorecidoId: favorecido.id, favorecido, count: reserved.length, revenue: reserved.reduce((sum, service) => sum + service.valorCobrado, 0), repasse: reserved.reduce((sum, service) => sum + service.valorRepasse, 0), margin: reserved.reduce((sum, service) => sum + service.valorCobrado - service.valorRepasse, 0), sentAt: "2026-01-28T14:00:00.000Z" };
  reserved.forEach((service) => { service.pagamentoId = lot.id; });
  return { favorecidos: [...mockFavorecidos], services, lots: [lot], items: reserved.map((service) => ({ id: `item-${service.id}`, paymentId: lot.id, serviceId: service.id, status: 100000000, ...service })), events: [{ id: "event-demo-001", paymentId: lot.id, operation: 100000000, message: "Lote de demonstracao criado.", version: 1 }] };
}

class DataverseClient {
  constructor() {
    this.xrm = getXrm(); this.clientUrl = this.xrm?.Utility?.getGlobalContext?.().getClientUrl?.() || ""; this.apiRoot = this.clientUrl ? `${this.clientUrl}/api/data/${API_VERSION}` : ""; this.mockMode = !this.clientUrl && localPreviewHost(); this.cache = new Map(); this.mock = buildMockState();
  }

  get available() { return Boolean(this.clientUrl || this.mockMode); }
  get environmentLabel() { return this.mockMode ? "Previa local" : this.clientUrl ? new URL(this.clientUrl).hostname : "Nao conectado"; }

  async request(method, path, body) {
    if (!this.clientUrl) throw new Error("Xrm nao encontrado. Abra o web resource dentro do model-driven app.");
    const response = await fetch(path.startsWith("http") ? path : `${this.apiRoot}${path}`, { method, headers: { Accept: "application/json", "Content-Type": "application/json; charset=utf-8", "OData-Version": "4.0", "OData-MaxVersion": "4.0", Prefer: 'return=representation,odata.include-annotations="OData.Community.Display.V1.FormattedValue"' }, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 204) return null;
    const text = await response.text(); const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.error?.message || `${response.status} ${response.statusText}`);
    return data;
  }

  async entity(logicalName) {
    if (this.cache.has(logicalName)) return this.cache.get(logicalName);
    const data = await this.request("GET", `/EntityDefinitions(LogicalName='${escapeOData(logicalName)}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`);
    const info = { logicalName, entitySet: data.EntitySetName, id: data.PrimaryIdAttribute, primaryName: data.PrimaryNameAttribute }; this.cache.set(logicalName, info); return info;
  }

  async listAll(logicalName, query = "", maxPages = 20) {
    if (this.mockMode) { const records = logicalName === TABLES.favorecido ? this.mock.favorecidos : logicalName === TABLES.payment ? this.mock.lots : logicalName === TABLES.item ? this.mock.items : logicalName === TABLES.event ? this.mock.events : this.mock.services; return records.map((record) => ({ ...record })); }
    const rows = []; let next = query;
    for (let page = 0; page < maxPages && next !== null; page += 1) { const entity = await this.entity(logicalName); const response = await this.request("GET", next.startsWith("http") ? next : `/${entity.entitySet}${next}`); rows.push(...(response?.value || [])); next = response?.["@odata.nextLink"] || null; }
    return rows;
  }

  async create(logicalName, payload) {
    if (this.mockMode) { const record = { ...payload, id: newId(logicalName) }; if (logicalName === TABLES.payment) this.mock.lots.push(record); if (logicalName === TABLES.item) this.mock.items.push(record); if (logicalName === TABLES.event) this.mock.events.push(record); return record; }
    const entity = await this.entity(logicalName); return this.request("POST", `/${entity.entitySet}`, payload);
  }

  async update(logicalName, id, payload) {
    if (this.mockMode) { const lot = this.mock.lots.find((row) => row.id === id); if (!lot) return null; Object.assign(lot, payload); if (payload.cr40f_status !== undefined) lot.status = payload.cr40f_status; if (payload.cr40f_pagoem) lot.paidAt = payload.cr40f_pagoem; if (payload.cr40f_comprovanteurl) lot.proofUrl = payload.cr40f_comprovanteurl; return { ...lot }; }
    const entity = await this.entity(logicalName); return this.request("PATCH", `/${entity.entitySet}(${cleanGuid(id)})`, payload);
  }

  async listFavorecidos() {
    if (this.mockMode) return this.mock.favorecidos.map((row) => ({ ...row }));
    const entity = await this.entity(TABLES.favorecido); const rows = await this.listAll(TABLES.favorecido, `?$select=${entity.id},${entity.primaryName},cr40f_nomerazaosocial,cr40f_tipopessoa,cr40f_cpfcnpj,cr40f_tipochavepix,cr40f_chavepix,cr40f_email,cr40f_status&$filter=cr40f_status eq ${CHOICES.activeFavorecido}&$orderby=${entity.primaryName} asc&$top=5000`);
    return rows.map((row) => ({ id: cleanGuid(row[entity.id]), nome: row.cr40f_nomerazaosocial || row[entity.primaryName] || "Sem nome", tipoPessoa: row.cr40f_tipopessoa === 100000001 ? "PJ" : "PF", documento: row.cr40f_cpfcnpj || "", tipoChavePix: row.cr40f_tipochavepix === 100000001 ? "E-mail" : row.cr40f_tipochavepix === 100000002 ? "Telefone" : row.cr40f_tipochavepix === 100000003 ? "Aleatoria" : "CPF/CNPJ", chavePix: row.cr40f_chavepix || "", email: row.cr40f_email || "", status: "ativo" }));
  }

  async listServices() {
    if (this.mockMode) return this.mock.services.map((row) => ({ ...row }));
    const [compositionRows, reservationRows] = await Promise.all([this.listAll(TABLES.composition, "?$select=cr40f_composicaodeprecosid,cr40f_id,_cr40f_servicorelacionadogeral_value,new_valortotal,new_status,cr40f_valorrepasseterceiro,cr40f_valorrepasseterceiro_base,_cr40f_terceirofavorecido_value&$filter=new_status eq 100000001&$top=5000"), this.listAll(TABLES.reservation, "?$select=cr40f_reservadeveiculosid,cr40f_id,cr40f_dataehorriodesada,cr40f_trajeto,cr40f_destino,_cr40f_motorista_value,_cr40f_cliente_value&$top=5000")]);
    const reservationById = new Map(reservationRows.map((row) => [cleanGuid(row.cr40f_reservadeveiculosid), row]));
    return compositionRows.map((composition) => { const reservation = reservationById.get(cleanGuid(composition._cr40f_servicorelacionadogeral_value)) || {}; const valorCobrado = Number(composition.new_valortotal || 0); const valorRepasse = Number(composition.cr40f_valorrepasseterceiro || composition.cr40f_valorrepasseterceiro_base || 0); return { id: cleanGuid(composition.cr40f_composicaodeprecosid), reservationId: cleanGuid(composition._cr40f_servicorelacionadogeral_value), identificador: composition.cr40f_id || reservation.cr40f_id || "Sem ID", dataServico: reservation.cr40f_dataehorriodesada || "", cliente: reservation["_cr40f_cliente_value@OData.Community.Display.V1.FormattedValue"] || "Nao informado", trajeto: reservation.cr40f_trajeto || reservation.cr40f_destino || "Nao informado", motorista: reservation["_cr40f_motorista_value@OData.Community.Display.V1.FormattedValue"] || "Nao informado", motoristaId: cleanGuid(reservation._cr40f_motorista_value), favorecidoId: cleanGuid(composition._cr40f_terceirofavorecido_value), valorCobrado, valorRepasse, status: "concluido" }; });
  }

  async createFavorecido(form) {
    const normalizedDocument = String(form.documento || "").replace(/\D/g, ""); if ((await this.listFavorecidos()).some((row) => String(row.documento || "").replace(/\D/g, "") === normalizedDocument)) throw new Error("Ja existe um Terceiro Favorecido ativo com este CPF/CNPJ.");
    if (this.mockMode) { const record = { ...form, id: newId("fav"), status: "ativo" }; this.mock.favorecidos.push(record); return record; }
    const payload = { cr40f_nomerazaosocial: form.nome.trim(), cr40f_tipopessoa: form.tipoPessoa === "PJ" ? 100000001 : 100000000, cr40f_cpfcnpj: form.documento.trim(), cr40f_tipochavepix: form.tipoChavePix === "E-mail" ? 100000001 : form.tipoChavePix === "Telefone" ? 100000002 : form.tipoChavePix === "Aleatoria" ? 100000003 : 100000000, cr40f_chavepix: form.chavePix.trim(), cr40f_email: form.email.trim(), cr40f_status: CHOICES.activeFavorecido }; await this.create(TABLES.favorecido, payload); return { ...form, status: "ativo" };
  }

  async createPayment(lot) {
    const identifier = `PT-${lot.year}-${String(Date.now()).slice(-6)}`;
    if (this.mockMode) { const id = newId("lot"); const record = { ...lot, id, identifier, status: 100000000, version: 1, favorecido: lot.favorecido, count: lot.services.length }; this.mock.lots.push(record); lot.services.forEach((service) => { const target = this.mock.services.find((row) => row.id === service.id); if (target) target.pagamentoId = id; this.mock.items.push({ id: newId("item"), paymentId: id, serviceId: service.id, ...service, status: 100000000 }); }); await this.createEvent(id, 100000000, "Lote criado e servicos reservados.", 1); return record; }
    const payload = { cr40f_status: 100000000, cr40f_versaoenvio: 1, cr40f_anoreferencia: lot.year, cr40f_identificadorlote: identifier, cr40f_quantidadeservicos: lot.services.length, cr40f_totalcobradocliente: lot.revenue, cr40f_totalrepasse: lot.repasse, cr40f_margemtotal: lot.margin, cr40f_emailfavorecidoenvio: lot.favorecido.email, cr40f_snapshotfavorecido: lot.favorecidoSnapshot, [`cr40f_terceirofavorecido@odata.bind`]: `/${(await this.entity(TABLES.favorecido)).entitySet}(${cleanGuid(lot.favorecidoId)})` }; const payment = await this.create(TABLES.payment, payload);
    for (const service of lot.services) { const item = { cr40f_identificadorservico: service.identificador, cr40f_servicoid: service.reservationId || service.id, cr40f_dataservico: service.dataServico, cr40f_cliente: service.cliente, cr40f_trajeto: service.trajeto, cr40f_motorista: service.motorista, cr40f_valorcobrado: service.valorCobrado, cr40f_valorrepasse: service.valorRepasse, cr40f_margem: service.valorCobrado - service.valorRepasse, cr40f_status: 100000000, cr40f_snapshotfinanceiro: JSON.stringify(service), [`cr40f_pagamentoaterceiro@odata.bind`]: `/${(await this.entity(TABLES.payment)).entitySet}(${cleanGuid(payment.cr40f_pagamentoaterceiroid || payment.id)})` }; await this.create(TABLES.item, item); }
    await this.createEvent(payment?.cr40f_pagamentoaterceiroid || payment?.id, 100000000, "Lote criado e servicos reservados.", 1); return { ...lot, id: payment?.cr40f_pagamentoaterceiroid || payment?.id, status: 100000000, identifier };
  }

  async createEvent(paymentId, operation, message, version) {
    if (this.mockMode) { const event = { id: newId("event"), paymentId, operation, message, version, createdAt: new Date().toISOString() }; this.mock.events.push(event); return event; }
    const payment = await this.entity(TABLES.payment); return this.create(TABLES.event, { [`cr40f_pagamentoaterceiro@odata.bind`]: `/${payment.entitySet}(${cleanGuid(paymentId)})`, cr40f_operacao: operation, cr40f_datahora: new Date().toISOString(), cr40f_mensagem: message, cr40f_versao: version });
  }

  async sendPayment(lot, operation = "enviar") {
    const id = lot.id || lot.cr40f_pagamentoaterceiroid; if (this.mockMode) { const target = this.mock.lots.find((row) => row.id === id); if (!target) throw new Error("Lote local nao encontrado."); target.status = 100000002; target.cr40f_status = 100000002; target.sentAt = new Date().toISOString(); await this.createEvent(id, operation === "reenviar" ? 100000002 : 100000001, "Documento enviado no modo local.", target.version || 1); return { ok: true, mode: "preview" }; }
    const flowUrl = window.__PAYMENT_FLOW_URL || window.__APP_FLOW_URL || ""; if (!flowUrl) throw new Error("URL do Flow de pagamento nao configurada. Defina window.__PAYMENT_FLOW_URL no web resource.");
    try { const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loteId: cleanGuid(id), operacao: operation, versao: lot.version || lot.cr40f_versaoenvio || 1, contratoOneDrive: FLOW_CONTRACT }) }); if (!response.ok) throw new Error(`Flow de pagamento retornou ${response.status}.`); const result = await response.json().catch(() => ({ ok: true })); await this.update(TABLES.payment, id, { cr40f_status: 100000002, cr40f_enviadoem: new Date().toISOString(), cr40f_erronotificacao: null }); await this.createEvent(id, operation === "reenviar" ? 100000002 : 100000001, "Documento enviado para geracao e notificacao.", lot.version || lot.cr40f_versaoenvio || 1); return result; } catch (error) { await this.update(TABLES.payment, id, { cr40f_status: 100000001, cr40f_erronotificacao: error.message }); throw error; }
  }

  async markPaid(lot, proofUrl = "") {
    const id = lot.id || lot.cr40f_pagamentoaterceiroid; if (this.mockMode) { const target = this.mock.lots.find((row) => row.id === id); if (!target) throw new Error("Lote local nao encontrado."); target.status = 100000003; target.cr40f_status = 100000003; target.paidAt = new Date().toISOString(); target.proofUrl = proofUrl; this.mock.items.filter((item) => item.paymentId === id).forEach((item) => { item.status = 100000001; }); await this.createEvent(id, proofUrl ? 100000004 : 100000003, "Pagamento PIX registrado no modo local.", target.version || 1); return { ...target }; }
    const result = await this.update(TABLES.payment, id, { cr40f_status: 100000003, cr40f_pagoem: new Date().toISOString(), ...(proofUrl ? { cr40f_comprovanteurl: proofUrl } : {}) }); await this.createEvent(id, proofUrl ? 100000004 : 100000003, "Pagamento PIX registrado.", lot.version || lot.cr40f_versaoenvio || 1); return result;
  }
}

export const dataverse = new DataverseClient();
