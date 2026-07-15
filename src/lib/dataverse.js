import {
  DOCUMENT_STATUS,
  ITEM_STATUS,
  LOT_STATUS,
  PAYMENT_STATUS,
  createLotSnapshot,
  paymentTotals,
  validateFavorecido,
} from "../domain/payment.js";

const API_VERSION = "v9.2";
const STORE_KEY = "betinhos_pagamentos_terceiros_mock_v4";
const FLOW_CONTRACT = "new_FlowURLFlowSalvarArquivosOnedrive";
export const TABLES = Object.freeze({
  employee: "cr40f_funcionarios",
  composition: "cr40f_composicaodeprecos",
  reservation: "cr40f_reservadeveculos",
  favorecido: "cr40f_terceirofavorecido",
  link: "cr40f_vinculomotoristafavorecido",
  payment: "cr40f_pagamentoaterceiro",
  item: "cr40f_itempagamentoaterceiro",
  event: "cr40f_eventopagamentoaterceiro",
});
export const CHOICES = Object.freeze({
  completedComposition: 100000001,
  activeEmployee: 0,
  activeFavorecido: 100000000,
  inactiveFavorecido: 100000001,
  activeLink: 100000000,
  inactiveLink: 100000001,
});

const cleanGuid = (value) => String(value || "").replace(/[{}]/g, "");
const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const localHost = () =>
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localPreviewHost = () =>
  localHost() ||
  (typeof window !== "undefined" && window.location.port === "5192") ||
  import.meta.env?.DEV === true;
const getXrm = () =>
  typeof window === "undefined"
    ? null
    : window.Xrm || window.parent?.Xrm || window.top?.Xrm || null;
const escapeOData = (value) => String(value).replace(/'/g, "''");
const normalizeLabel = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const reservationDetailLabels = Object.freeze({
  dataFinalizacao: [
    "horário de finalização",
    "data/hora de finalização",
    "finalização",
  ],
  observacaoOperacao: ["observação de operação", "observações da operação"],
  tipoVeiculo: ["tipo de veículo", "tipo veículo"],
  veiculo: ["veículo"],
  observacaoFinal: ["observação final", "observações finais"],
});
const fieldValue = (row, logicalName) =>
  logicalName
    ? row[`${logicalName}@OData.Community.Display.V1.FormattedValue`] ||
      row[logicalName] ||
      ""
    : "";
const selectableAttributeName = (attribute) =>
  attribute?.AttributeType === "Lookup"
    ? `_${attribute.LogicalName}_value`
    : attribute?.LogicalName || "";

const drivers = [
  "Carlos Henrique",
  "Marcos Lima",
  "Fernanda Alves",
  "Rafael Costa",
  "Juliana Prado",
].map((nome, index) => ({
  id: `mot-${String(index + 1).padStart(3, "0")}`,
  nome,
  status: "ativo",
}));
const seedFavorecidos = [
  {
    id: "fav-001",
    nome: "Alfa Transporte Executivo Ltda.",
    tipoPessoa: "PJ",
    documento: "12.345.678/0001-90",
    tipoChavePix: "CPF/CNPJ",
    chavePix: "12.345.678/0001-90",
    email: "financeiro@alfatransporte.com.br",
    telefone: "11999990001",
    status: "ativo",
  },
  {
    id: "fav-002",
    nome: "Carlos Henrique Souza",
    tipoPessoa: "PF",
    documento: "529.982.247-25",
    tipoChavePix: "CPF/CNPJ",
    chavePix: "529.982.247-25",
    email: "carlos.souza@email.com",
    telefone: "11999990002",
    status: "ativo",
  },
  {
    id: "fav-003",
    nome: "Beta Mobilidade Corporativa",
    tipoPessoa: "PJ",
    documento: "45.678.901/0001-22",
    tipoChavePix: "CPF/CNPJ",
    chavePix: "45.678.901/0001-22",
    email: "contas@betamobilidade.com.br",
    telefone: "11999990003",
    status: "ativo",
  },
  {
    id: "fav-004",
    nome: "Fernanda Alves",
    tipoPessoa: "PF",
    documento: "111.444.777-35",
    tipoChavePix: "E-mail",
    chavePix: "fernanda.alves@email.com",
    email: "fernanda.alves@email.com",
    telefone: "11999990004",
    status: "ativo",
  },
  {
    id: "fav-005",
    nome: "Gamma Eventos e Logística",
    tipoPessoa: "PJ",
    documento: "78.901.234/0001-33",
    tipoChavePix: "CPF/CNPJ",
    chavePix: "78.901.234/0001-33",
    email: "financeiro@gammaeventos.com.br",
    telefone: "11999990005",
    status: "inativo",
  },
];

function seedLinks() {
  return drivers.flatMap((driver, index) =>
    [0, 1].map((offset) => ({
      id: `link-${index}-${offset}`,
      motoristaId: driver.id,
      favorecidoId: seedFavorecidos[(index + offset) % 4].id,
      status: "ativo",
      createdAt: now(),
    })),
  );
}
function seedServices() {
  const routes = [
    "GRU → Faria Lima",
    "Congonhas → Campinas",
    "Paulista → Guarulhos",
    "Jundiaí → GRU",
    "Moema → Santos",
    "Barra Funda → Sorocaba",
  ];
  return Array.from({ length: 96 }, (_, index) => {
    const driver = drivers[index % drivers.length];
    const value = 780 + ((index * 137) % 1900);
    const missing = index > 0 && index % 17 === 0;
    const noLink = index % 13 === 0;
    return {
      id: `srv-${String(index + 1).padStart(4, "0")}`,
      compositionId: `cmp-${String(index + 1).padStart(4, "0")}`,
      reservationId: `res-${String(index + 1).padStart(4, "0")}`,
      identificador: `SRV-2026-${String(index + 184).padStart(4, "0")}`,
      dataServico: new Date(
        Date.UTC(2026, index % 12, 3 + (index % 24), 15),
      ).toISOString(),
      dataFinalizacao: new Date(
        Date.UTC(2026, index % 12, 3 + (index % 24), 15, 45 + (index % 3) * 20),
      ).toISOString(),
      cliente: [
        "Diretoria Acme",
        "Grupo Horizonte",
        "Núcleo Financeiro",
        "Alfa Eventos",
        "Operação Sul",
      ][index % 5],
      trajeto: routes[index % routes.length],
      observacaoOperacao: [
        "Aguardar no desembarque",
        "Bagagem de mão",
        "Recepção no saguão",
        "Sem observação operacional",
      ][index % 4],
      motorista: driver.nome,
      motoristaId: driver.id,
      tipoVeiculo: ["Sedan executivo", "SUV executivo", "Van executiva"][
        index % 3
      ],
      veiculo: [
        "Toyota Corolla",
        "Chevrolet Trailblazer",
        "Mercedes-Benz Sprinter",
      ][index % 3],
      observacaoFinal:
        index % 5 === 0 ? "Serviço concluído sem intercorrências." : "",
      favorecidoId: noLink
        ? ""
        : seedLinks().find((link) => link.motoristaId === driver.id)
            ?.favorecidoId || "",
      valorCobrado: value,
      valorRepasse: missing
        ? 0
        : Math.round(
            value * (index % 11 === 0 ? 1.08 : 0.49 + (index % 8) / 100),
          ),
      status: index % 19 === 0 ? "pendente" : "concluido",
      pagamentoId: "",
      etag: 1,
    };
  });
}
function buildState() {
  const services = seedServices();
  const links = seedLinks();
  const initial = services
    .filter(
      (service) =>
        service.status === "concluido" &&
        service.valorRepasse > 0 &&
        service.favorecidoId,
    )
    .slice(0, 2);
  const favorecido = seedFavorecidos.find(
    (row) => row.id === initial[0].favorecidoId,
  );
  const snapshot = createLotSnapshot(favorecido, initial, 2026);
  const lot = {
    ...snapshot,
    id: "lot-demo-001",
    identifier: "PT-2026-000001",
    documentStatus: DOCUMENT_STATUS.SENT,
    paymentStatus: PAYMENT_STATUS.PAID,
    paidAt: "2026-01-28T14:00:00.000Z",
    documentUrl: "https://onedrive.local/PT-2026-000001-v1.pdf",
    documentName: "Pagamento_PT-2026-000001_v1.pdf",
  };
  initial.forEach((service) => {
    service.pagamentoId = lot.id;
  });
  return {
    drivers,
    favorecidos: clone(seedFavorecidos),
    links,
    services,
    lots: [lot],
    items: initial.map((service) => ({
      id: `item-${service.id}`,
      paymentId: lot.id,
      serviceId: service.id,
      itemStatus: ITEM_STATUS.PAID,
      ...clone(service),
    })),
    events: [
      {
        id: "evt-demo",
        paymentId: lot.id,
        operation: "document_sent",
        result: "success",
        message: "Documento enviado ao favorecido.",
        version: 1,
        createdAt: now(),
        user: "Financeiro Betinhos",
        documentUrl: lot.documentUrl,
      },
    ],
    failNext: {},
  };
}

class DataverseClient {
  constructor() {
    this.xrm = getXrm();
    this.clientUrl =
      this.xrm?.Utility?.getGlobalContext?.().getClientUrl?.() || "";
    this.apiRoot = this.clientUrl
      ? `${this.clientUrl}/api/data/${API_VERSION}`
      : "";
    this.mockMode = !this.clientUrl && localPreviewHost();
    this.cache = new Map();
    this.mock = this.loadMock();
  }
  get available() {
    return Boolean(this.clientUrl || this.mockMode);
  }
  get environmentLabel() {
    return this.mockMode
      ? "Prévia local"
      : this.clientUrl
        ? new URL(this.clientUrl).hostname
        : "Não conectado";
  }
  loadMock() {
    try {
      const saved =
        typeof localStorage !== "undefined" && localStorage.getItem(STORE_KEY);
      return saved ? JSON.parse(saved) : buildState();
    } catch {
      return buildState();
    }
  }
  persistMock() {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORE_KEY, JSON.stringify(this.mock));
  }
  resetMock() {
    this.mock = buildState();
    this.persistMock();
    return clone(this.mock);
  }
  setMockFailure(key) {
    this.mock.failNext[key] = true;
    this.persistMock();
  }
  consumeFailure(key) {
    if (this.mock.failNext[key]) {
      delete this.mock.failNext[key];
      this.persistMock();
      throw new Error(`Falha simulada em ${key}. Tente novamente.`);
    }
  }
  async request(method, path, body, headers = {}) {
    if (!this.clientUrl)
      throw new Error(
        "Xrm não encontrado. Abra o web resource dentro do model-driven app.",
      );
    const response = await fetch(
      path.startsWith("http") ? path : `${this.apiRoot}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          "OData-Version": "4.0",
          "OData-MaxVersion": "4.0",
          Prefer:
            'return=representation,odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (response.status === 204) return null;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok)
      throw new Error(
        data?.error?.message || `${response.status} ${response.statusText}`,
      );
    return data;
  }
  async entity(logicalName) {
    if (this.cache.has(logicalName)) return this.cache.get(logicalName);
    const data = await this.request(
      "GET",
      `/EntityDefinitions(LogicalName='${escapeOData(logicalName)}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`,
    );
    const info = {
      logicalName,
      entitySet: data.EntitySetName,
      id: data.PrimaryIdAttribute,
      primaryName: data.PrimaryNameAttribute,
    };
    this.cache.set(logicalName, info);
    return info;
  }
  async listAll(logicalName, query = "", maxPages = 20) {
    if (this.mockMode) {
      const key =
        logicalName === TABLES.favorecido
          ? "favorecidos"
          : logicalName === TABLES.link
            ? "links"
            : logicalName === TABLES.payment
              ? "lots"
              : logicalName === TABLES.item
                ? "items"
                : logicalName === TABLES.event
                  ? "events"
                  : logicalName === TABLES.employee
                    ? "drivers"
                    : "services";
      return clone(this.mock[key]);
    }
    const rows = [];
    let next = query;
    for (let page = 0; page < maxPages && next !== null; page += 1) {
      const entity = await this.entity(logicalName);
      const response = await this.request(
        "GET",
        next.startsWith("http") ? next : `/${entity.entitySet}${next}`,
      );
      rows.push(...(response?.value || []));
      next = response?.["@odata.nextLink"] || null;
    }
    return rows;
  }
  async create(logicalName, payload) {
    const entity = await this.entity(logicalName);
    return this.request("POST", `/${entity.entitySet}`, payload);
  }
  async update(logicalName, id, payload, etag = "*") {
    const entity = await this.entity(logicalName);
    return this.request(
      "PATCH",
      `/${entity.entitySet}(${cleanGuid(id)})`,
      payload,
      { "If-Match": etag },
    );
  }
  async listDrivers() {
    if (this.mockMode) return clone(this.mock.drivers);
    const entity = await this.entity(TABLES.employee);
    const rows = await this.listAll(
      TABLES.employee,
      `?$select=${entity.id},${entity.primaryName},statecode&$filter=statecode eq ${CHOICES.activeEmployee}&$orderby=${entity.primaryName} asc`,
    );
    return rows.map((row) => ({
      id: cleanGuid(row[entity.id]),
      nome: row[entity.primaryName],
      status: "ativo",
    }));
  }
  async listFavorecidos(includeInactive = false) {
    if (this.mockMode)
      return clone(
        this.mock.favorecidos.filter(
          (row) => includeInactive || row.status === "ativo",
        ),
      );
    const entity = await this.entity(TABLES.favorecido);
    const filter = includeInactive
      ? ""
      : `&$filter=cr40f_status eq ${CHOICES.activeFavorecido}`;
    const rows = await this.listAll(
      TABLES.favorecido,
      `?$select=${entity.id},${entity.primaryName},cr40f_nomerazaosocial,cr40f_tipopessoa,cr40f_cpfcnpj,cr40f_tipochavepix,cr40f_chavepix,cr40f_email,cr40f_telefone,cr40f_status${filter}&$orderby=${entity.primaryName} asc`,
    );
    return rows.map((row) => ({
      id: cleanGuid(row[entity.id]),
      nome: row.cr40f_nomerazaosocial || row[entity.primaryName] || "Sem nome",
      tipoPessoa: row.cr40f_tipopessoa === 100000001 ? "PJ" : "PF",
      documento: row.cr40f_cpfcnpj || "",
      tipoChavePix:
        row.cr40f_tipochavepix === 100000001
          ? "E-mail"
          : row.cr40f_tipochavepix === 100000002
            ? "Telefone"
            : row.cr40f_tipochavepix === 100000003
              ? "Aleatória"
              : "CPF/CNPJ",
      chavePix: row.cr40f_chavepix || "",
      email: row.cr40f_email || "",
      telefone: row.cr40f_telefone || "",
      status:
        row.cr40f_status === CHOICES.activeFavorecido ? "ativo" : "inativo",
    }));
  }
  async createFavorecido(form) {
    const errors = validateFavorecido(form);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const all = await this.listFavorecidos(true);
    const normalized = String(form.documento).replace(/\D/g, "");
    if (
      all.some((row) => String(row.documento).replace(/\D/g, "") === normalized)
    )
      throw new Error("Já existe Terceiro Favorecido com este CPF/CNPJ.");
    if (
      all.some(
        (row) =>
          String(row.chavePix).trim().toLowerCase() ===
          String(form.chavePix).trim().toLowerCase(),
      )
    )
      throw new Error("Já existe Terceiro Favorecido com esta chave PIX.");
    if (this.mockMode) {
      const record = { ...clone(form), id: newId("fav"), status: "ativo" };
      this.mock.favorecidos.push(record);
      this.persistMock();
      return clone(record);
    }
    return this.create(TABLES.favorecido, {
      cr40f_nomerazaosocial: form.nome.trim(),
      cr40f_tipopessoa: form.tipoPessoa === "PJ" ? 100000001 : 100000000,
      cr40f_cpfcnpj: form.documento.trim(),
      cr40f_tipochavepix:
        form.tipoChavePix === "E-mail"
          ? 100000001
          : form.tipoChavePix === "Telefone"
            ? 100000002
            : form.tipoChavePix === "Aleatória"
              ? 100000003
              : 100000000,
      cr40f_chavepix: form.chavePix.trim(),
      cr40f_email: form.email.trim(),
      cr40f_telefone: form.telefone?.trim() || "",
      cr40f_status: CHOICES.activeFavorecido,
    });
  }
  async updateFavorecido(id, form) {
    if (this.mockMode) {
      const row = this.mock.favorecidos.find((item) => item.id === id);
      if (!row) throw new Error("Favorecido não encontrado.");
      Object.assign(row, clone(form));
      this.persistMock();
      return clone(row);
    }
    return this.update(TABLES.favorecido, id, {
      cr40f_nomerazaosocial: form.nome,
      cr40f_cpfcnpj: form.documento,
      cr40f_chavepix: form.chavePix,
      cr40f_email: form.email,
      cr40f_telefone: form.telefone || "",
    });
  }
  async setFavorecidoStatus(id, status) {
    if (this.mockMode) {
      const row = this.mock.favorecidos.find((item) => item.id === id);
      row.status = status;
      this.persistMock();
      return clone(row);
    }
    return this.update(TABLES.favorecido, id, {
      cr40f_status:
        status === "ativo"
          ? CHOICES.activeFavorecido
          : CHOICES.inactiveFavorecido,
    });
  }
  async listLinks() {
    if (this.mockMode) return clone(this.mock.links);
    const rows = await this.listAll(
      TABLES.link,
      "?$select=cr40f_vinculomotoristafavorecidoid,_cr40f_motorista_value,_cr40f_terceirofavorecido_value,cr40f_status&$top=5000",
    );
    return rows.map((row) => ({
      id: cleanGuid(row.cr40f_vinculomotoristafavorecidoid),
      motoristaId: cleanGuid(row._cr40f_motorista_value),
      favorecidoId: cleanGuid(row._cr40f_terceirofavorecido_value),
      status: row.cr40f_status === CHOICES.activeLink ? "ativo" : "inativo",
    }));
  }
  async upsertLink(motoristaId, favorecidoId) {
    if (this.mockMode) {
      let row = this.mock.links.find(
        (item) =>
          item.motoristaId === motoristaId &&
          item.favorecidoId === favorecidoId,
      );
      if (row) row.status = "ativo";
      else {
        row = {
          id: newId("link"),
          motoristaId,
          favorecidoId,
          status: "ativo",
          createdAt: now(),
        };
        this.mock.links.push(row);
      }
      this.persistMock();
      return clone(row);
    }
    const existing = (await this.listLinks()).find(
      (row) =>
        row.motoristaId === motoristaId && row.favorecidoId === favorecidoId,
    );
    if (existing)
      return this.update(TABLES.link, existing.id, {
        cr40f_status: CHOICES.activeLink,
      });
    const employee = await this.entity(TABLES.employee);
    const fav = await this.entity(TABLES.favorecido);
    return this.create(TABLES.link, {
      [`cr40f_motorista@odata.bind`]: `/${employee.entitySet}(${cleanGuid(motoristaId)})`,
      [`cr40f_terceirofavorecido@odata.bind`]: `/${fav.entitySet}(${cleanGuid(favorecidoId)})`,
      cr40f_status: CHOICES.activeLink,
    });
  }
  async setLinkStatus(id, status) {
    if (this.mockMode) {
      const row = this.mock.links.find((item) => item.id === id);
      row.status = status;
      this.persistMock();
      return clone(row);
    }
    return this.update(TABLES.link, id, {
      cr40f_status:
        status === "ativo" ? CHOICES.activeLink : CHOICES.inactiveLink,
    });
  }
  async reservationOperationalFields() {
    const cacheKey = "reservationOperationalFields";
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const response = await this.request(
      "GET",
      `/EntityDefinitions(LogicalName='${escapeOData(TABLES.reservation)}')/Attributes?$select=LogicalName,DisplayName,AttributeType`,
    ).catch(() => ({ value: [] }));
    const attributes = response.value || [];
    const resolved = Object.fromEntries(
      Object.entries(reservationDetailLabels).map(([key, labels]) => {
        const attribute = attributes.find((row) => {
          const label = normalizeLabel(
            row.DisplayName?.UserLocalizedLabel?.Label ||
              row.DisplayName?.LocalizedLabels?.[0]?.Label,
          );
          return labels.some(
            (candidate) => label === normalizeLabel(candidate),
          );
        });
        return [key, selectableAttributeName(attribute)];
      }),
    );
    this.cache.set(cacheKey, resolved);
    return resolved;
  }
  async listFinanceServices(filters = {}) {
    if (this.mockMode)
      return clone(
        this.mock.services.filter(
          (row) =>
            (!filters.from || row.dataServico >= filters.from) &&
            (!filters.to || row.dataServico.slice(0, 10) <= filters.to) &&
            (!filters.motoristaId || row.motoristaId === filters.motoristaId),
        ),
      );
    const operationalFields = await this.reservationOperationalFields();
    const extraFields = Object.values(operationalFields).filter(Boolean);
    const [compositionRows, reservationRows] = await Promise.all([
      this.listAll(
        TABLES.composition,
        "?$select=cr40f_composicaodeprecosid,cr40f_id,_cr40f_servicorelacionadogeral_value,new_valortotal,new_status,cr40f_valorrepasseterceiro,_cr40f_terceirofavorecido_value,_cr40f_pagamentoaterceiro_value&$filter=new_status eq 100000001&$top=5000",
      ),
      this.listAll(
        TABLES.reservation,
        `?$select=cr40f_reservadeveculosid,cr40f_id,cr40f_dataehorriodesada,cr40f_trajeto,cr40f_destino,_cr40f_motorista_value,_cr40f_cliente_value${extraFields.length ? `,${extraFields.join(",")}` : ""}&$top=5000`,
      ),
    ]);
    const reservations = new Map(
      reservationRows.map((row) => [
        cleanGuid(row.cr40f_reservadeveculosid),
        row,
      ]),
    );
    return compositionRows.map((composition) => {
      const reservation =
        reservations.get(
          cleanGuid(composition._cr40f_servicorelacionadogeral_value),
        ) || {};
      return {
        id: cleanGuid(composition.cr40f_composicaodeprecosid),
        compositionId: cleanGuid(composition.cr40f_composicaodeprecosid),
        reservationId: cleanGuid(
          composition._cr40f_servicorelacionadogeral_value,
        ),
        identificador: composition.cr40f_id || reservation.cr40f_id || "Sem ID",
        dataServico: reservation.cr40f_dataehorriodesada || "",
        dataFinalizacao: fieldValue(
          reservation,
          operationalFields.dataFinalizacao,
        ),
        cliente:
          reservation[
            "_cr40f_cliente_value@OData.Community.Display.V1.FormattedValue"
          ] || "Não informado",
        trajeto:
          reservation.cr40f_trajeto ||
          reservation.cr40f_destino ||
          "Não informado",
        motorista:
          reservation[
            "_cr40f_motorista_value@OData.Community.Display.V1.FormattedValue"
          ] || "Não informado",
        motoristaId: cleanGuid(reservation._cr40f_motorista_value),
        tipoVeiculo: fieldValue(reservation, operationalFields.tipoVeiculo),
        veiculo: fieldValue(reservation, operationalFields.veiculo),
        observacaoOperacao: fieldValue(
          reservation,
          operationalFields.observacaoOperacao,
        ),
        observacaoFinal: fieldValue(
          reservation,
          operationalFields.observacaoFinal,
        ),
        favorecidoId: cleanGuid(composition._cr40f_terceirofavorecido_value),
        pagamentoId: cleanGuid(composition._cr40f_pagamentoaterceiro_value),
        valorCobrado: Number(composition.new_valortotal || 0),
        valorRepasse: Number(composition.cr40f_valorrepasseterceiro || 0),
        status: "concluido",
        etag: composition["@odata.etag"] || "*",
      };
    });
  }
  async listServices() {
    return this.listFinanceServices();
  }
  async saveServiceRepasse(serviceId, value, etag = "*") {
    if (Number(value) < 0) throw new Error("Repasse não pode ser negativo.");
    if (this.mockMode) {
      this.consumeFailure("repasse");
      const service = this.mock.services.find((row) => row.id === serviceId);
      if (!service) throw new Error("Serviço não encontrado.");
      if (etag !== "*" && Number(etag) !== Number(service.etag))
        throw new Error(
          "Serviço alterado por outro usuário. Atualize a lista.",
        );
      service.valorRepasse = Number(value);
      service.etag += 1;
      this.persistMock();
      return clone(service);
    }
    return this.update(
      TABLES.composition,
      serviceId,
      { cr40f_valorrepasseterceiro: Number(value) },
      etag,
    );
  }
  async setPreferredFavorecido(serviceId, favorecidoId) {
    if (this.mockMode) {
      const service = this.mock.services.find((row) => row.id === serviceId);
      if (!service) throw new Error("Serviço não encontrado.");
      await this.upsertLink(service.motoristaId, favorecidoId);
      service.favorecidoId = favorecidoId;
      this.persistMock();
      return clone(service);
    }
    const fav = await this.entity(TABLES.favorecido);
    return this.update(TABLES.composition, serviceId, {
      [`cr40f_terceirofavorecido@odata.bind`]: `/${fav.entitySet}(${cleanGuid(favorecidoId)})`,
    });
  }
  addEvent(paymentId, operation, message, extra = {}) {
    const event = {
      id: newId("evt"),
      paymentId,
      operation,
      message,
      result: extra.result || "success",
      previous: extra.previous || "",
      next: extra.next || "",
      reason: extra.reason || "",
      version: extra.version || 1,
      user: "Financeiro Betinhos",
      createdAt: now(),
      ...extra,
    };
    this.mock.events.unshift(event);
    return event;
  }
  async createDraftLot(input) {
    const services = input.services || [];
    if (!services.length) throw new Error("Selecione pelo menos um serviço.");
    const links = await this.listLinks();
    const actual = (await this.listFinanceServices()).filter((row) =>
      services.some((item) => item.id === row.id),
    );
    const invalid = actual.filter(
      (service) =>
        service.pagamentoId ||
        service.valorRepasse <= 0 ||
        !links.some(
          (link) =>
            link.status === "ativo" &&
            link.motoristaId === service.motoristaId &&
            link.favorecidoId === input.favorecido.id,
        ),
    );
    if (invalid.length)
      throw new Error(
        `Há ${invalid.length} serviço(s) indisponível(is) para este favorecido.`,
      );
    const snapshot = createLotSnapshot(input.favorecido, actual, input.year);
    const identifier = `PT-${input.year}-${String(Date.now()).slice(-6)}`;
    if (this.mockMode) {
      this.consumeFailure("reserve");
      const lot = {
        ...snapshot,
        id: newId("lot"),
        identifier,
        items: actual.map((service) => ({
          ...service,
          itemStatus: ITEM_STATUS.RESERVED,
        })),
      };
      this.mock.lots.unshift(lot);
      actual.forEach((service) => {
        this.mock.services.find((row) => row.id === service.id).pagamentoId =
          lot.id;
        this.mock.items.push({
          id: newId("item"),
          paymentId: lot.id,
          serviceId: service.id,
          ...service,
          itemStatus: ITEM_STATUS.RESERVED,
        });
      });
      this.addEvent(
        lot.id,
        "draft_created",
        "Lote criado e serviços reservados.",
        { next: "Rascunho" },
      );
      this.persistMock();
      return clone(lot);
    }
    const payment = await this.create(TABLES.payment, {
      cr40f_statuslote: 100000000,
      cr40f_statuspagamento: 100000000,
      cr40f_statusdocumento: 100000000,
      cr40f_versaoenvio: 1,
      cr40f_anoreferencia: input.year,
      cr40f_identificadorlote: identifier,
      cr40f_quantidadeservicos: snapshot.count,
      cr40f_totalcobradocliente: snapshot.revenue,
      cr40f_totalrepasse: snapshot.repasse,
      cr40f_margemtotal: snapshot.margin,
      cr40f_emailfavorecidoenvio: input.favorecido.email,
      cr40f_snapshotfavorecido: snapshot.favorecidoSnapshot,
    });
    return {
      ...snapshot,
      id: payment?.cr40f_pagamentoaterceiroid || payment?.id,
      identifier,
    };
  }
  async updateDraftLot(lotId, input) {
    if (!this.mockMode)
      throw new Error("Edição remota exige metadata do lote provisionada.");
    const lot = this.mock.lots.find((row) => row.id === lotId);
    if (!lot || lot.paymentStatus !== PAYMENT_STATUS.OPEN)
      throw new Error("Apenas lote em aberto pode ser editado.");
    const selected = this.mock.services.filter((row) =>
      input.serviceIds.includes(row.id),
    );
    this.mock.services
      .filter(
        (row) =>
          row.pagamentoId === lotId && !input.serviceIds.includes(row.id),
      )
      .forEach((row) => {
        row.pagamentoId = "";
      });
    selected.forEach((row) => {
      if (row.pagamentoId && row.pagamentoId !== lotId)
        throw new Error(`${row.identificador} já está reservado.`);
      row.pagamentoId = lotId;
    });
    const fav = this.mock.favorecidos.find(
      (row) => row.id === input.favorecidoId,
    );
    Object.assign(lot, createLotSnapshot(fav, selected, input.year), {
      id: lot.id,
      identifier: lot.identifier,
      version: lot.version,
    });
    this.mock.items = this.mock.items.filter((row) => row.paymentId !== lotId);
    selected.forEach((row) =>
      this.mock.items.push({
        id: newId("item"),
        paymentId: lotId,
        serviceId: row.id,
        ...row,
        itemStatus: ITEM_STATUS.RESERVED,
      }),
    );
    this.addEvent(lotId, "draft_updated", "Serviços do rascunho atualizados.", {
      next: "Rascunho",
      version: lot.version,
    });
    this.persistMock();
    return clone(lot);
  }
  async cancelLot(lotId, reason) {
    if (!String(reason || "").trim())
      throw new Error("Informe o motivo do cancelamento.");
    if (!this.mockMode)
      return this.update(TABLES.payment, lotId, {
        cr40f_statuslote: 100000001,
        cr40f_canceladoem: now(),
        cr40f_motivocancelamento: reason,
      });
    const lot = this.mock.lots.find((row) => row.id === lotId);
    if (!lot || lot.paymentStatus !== PAYMENT_STATUS.OPEN)
      throw new Error("Reverta o pagamento antes de cancelar.");
    lot.lotStatus = LOT_STATUS.CANCELLED;
    this.mock.services
      .filter((row) => row.pagamentoId === lotId)
      .forEach((row) => {
        row.pagamentoId = "";
      });
    this.mock.items
      .filter((row) => row.paymentId === lotId)
      .forEach((row) => {
        row.itemStatus = ITEM_STATUS.CANCELLED;
      });
    this.addEvent(lotId, "cancelled", "Lote cancelado e serviços liberados.", {
      previous: "Rascunho",
      next: "Cancelado",
      reason,
      version: lot.version,
    });
    this.persistMock();
    return clone(lot);
  }
  async markPaid(lotId, proofUrl = "") {
    if (!this.mockMode)
      return this.update(TABLES.payment, lotId, {
        cr40f_statuspagamento: 100000001,
        cr40f_pagoem: now(),
        ...(proofUrl ? { cr40f_comprovanteurl: proofUrl } : {}),
      });
    const lot = this.mock.lots.find((row) => row.id === lotId);
    if (
      !lot ||
      lot.lotStatus !== LOT_STATUS.DRAFT ||
      lot.paymentStatus !== PAYMENT_STATUS.OPEN
    )
      throw new Error("Lote indisponível para pagamento.");
    lot.paymentStatus = PAYMENT_STATUS.PAID;
    lot.paidAt = now();
    lot.proofUrl = proofUrl;
    lot.documentStatus = DOCUMENT_STATUS.SENDING;
    this.mock.items
      .filter((row) => row.paymentId === lotId)
      .forEach((row) => {
        row.itemStatus = ITEM_STATUS.PAID;
      });
    this.addEvent(lotId, "paid", "Pagamento integral registrado.", {
      previous: "Em aberto",
      next: "Pago",
      version: lot.version,
    });
    this.persistMock();
    return clone(lot);
  }
  async revertPaid(lotId, reason) {
    if (!String(reason || "").trim())
      throw new Error("Informe o motivo da reversão.");
    if (!this.mockMode)
      return this.update(TABLES.payment, lotId, {
        cr40f_statuspagamento: 100000000,
        cr40f_pagamentorevertidoem: now(),
        cr40f_motivoreversaopagamento: reason,
        cr40f_statusdocumento: 100000004,
      });
    const lot = this.mock.lots.find((row) => row.id === lotId);
    if (!lot || lot.paymentStatus !== PAYMENT_STATUS.PAID)
      throw new Error("Lote não está pago.");
    lot.paymentStatus = PAYMENT_STATUS.OPEN;
    lot.documentStatus = DOCUMENT_STATUS.RESEND_REQUIRED;
    lot.version += 1;
    this.mock.items
      .filter((row) => row.paymentId === lotId)
      .forEach((row) => {
        row.itemStatus = ITEM_STATUS.RESERVED;
      });
    this.addEvent(
      lotId,
      "paid_reverted",
      "Pagamento revertido; novo documento será obrigatório.",
      { previous: "Pago", next: "Em aberto", reason, version: lot.version },
    );
    this.persistMock();
    return clone(lot);
  }
  async saveDocumentToOneDrive(lot, pdf) {
    this.consumeFailure("onedrive");
    if (this.mockMode)
      return {
        url: `https://onedrive.local/${lot.identifier}-v${lot.version}.pdf`,
        name: pdf.name,
      };
    const endpoint =
      window.__ONEDRIVE_FLOW_URL || window.__PAYMENT_FLOW_URL || "";
    if (!endpoint) throw new Error("URL do Flow de OneDrive não configurada.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caminhoCompleto: `Pagamentos a Terceiros/${lot.year}/${lot.favorecido?.nome || "Favorecido"}/${lot.identifier}`,
        nomeArquivo: pdf.name,
        conteudoBase64: pdf.base64,
        mimeType: "application/pdf",
        metadados: {
          loteId: lot.id,
          versao: lot.version,
          contrato: FLOW_CONTRACT,
        },
      }),
    });
    if (!response.ok)
      throw new Error(`Flow OneDrive retornou ${response.status}.`);
    return response.json();
  }
  async sendEmailWithPdf(lot, pdf) {
    this.consumeFailure("email");
    if (this.mockMode)
      return { id: newId("email"), subject: `Pagamento ${lot.identifier}` };
    const queueId = window.__FINANCE_QUEUE_ID || "";
    const financeCopy = window.__FINANCE_COPY_EMAIL || "";
    if (!queueId || !financeCopy)
      throw new Error("Configure Queue e e-mail de cópia do Financeiro.");
    const email = await this.request("POST", "/emails", {
      subject: `Pagamento ${lot.identifier}`,
      description: `Prezada(o), segue demonstrativo de pagamento ${lot.identifier} em anexo.`,
      directioncode: true,
      email_activity_parties: [
        {
          participationtypemask: 1,
          [`partyid_queue@odata.bind`]: `/queues(${cleanGuid(queueId)})`,
        },
        {
          participationtypemask: 2,
          addressused: JSON.parse(lot.favorecidoSnapshot).email,
          unresolvedpartyname: JSON.parse(lot.favorecidoSnapshot).nome,
        },
        {
          participationtypemask: 3,
          addressused: financeCopy,
          unresolvedpartyname: "Financeiro Betinhos",
        },
      ],
    });
    const emailId = email?.activityid || email?.emailid;
    await this.request("POST", "/activitymimeattachments", {
      subject: pdf.name,
      filename: pdf.name,
      mimetype: "application/pdf",
      body: pdf.base64,
      "objectid_email@odata.bind": `/emails(${cleanGuid(emailId)})`,
    });
    await this.request(
      "POST",
      `/emails(${cleanGuid(emailId)})/Microsoft.Dynamics.CRM.SendEmail`,
      { IssueSend: true },
    );
    return { id: emailId };
  }
  async registerDocumentResult(lotId, result) {
    if (!this.mockMode)
      return this.update(TABLES.payment, lotId, {
        cr40f_statusdocumento: result.ok ? 100000002 : 100000003,
        cr40f_documentourl: result.url || null,
        cr40f_documentonome: result.name || null,
        cr40f_documentoemailid: result.emailId || null,
        cr40f_errodocumento: result.error || null,
      });
    const lot = this.mock.lots.find((row) => row.id === lotId);
    lot.documentStatus = result.ok
      ? DOCUMENT_STATUS.SENT
      : DOCUMENT_STATUS.FAILED;
    lot.documentUrl = result.url || lot.documentUrl || "";
    lot.documentName = result.name || lot.documentName || "";
    lot.emailId = result.emailId || "";
    lot.documentError = result.error || "";
    this.addEvent(
      lotId,
      result.ok ? "document_sent" : "document_failed",
      result.ok
        ? "PDF salvo e enviado por e-mail."
        : "Falha ao gerar ou enviar documento.",
      {
        result: result.ok ? "success" : "failure",
        version: lot.version,
        documentUrl: result.url || "",
        detail: result.error || "",
      },
    );
    this.persistMock();
    return clone(lot);
  }
  async getLotDetail(lotId) {
    const lot = this.mockMode
      ? this.mock.lots.find((row) => row.id === lotId)
      : null;
    if (this.mockMode)
      return {
        ...clone(lot),
        items: clone(this.mock.items.filter((row) => row.paymentId === lotId)),
        events: clone(
          this.mock.events.filter((row) => row.paymentId === lotId),
        ),
      };
    throw new Error(
      "Consulta de detalhe remoto requer metadata dos itens e eventos provisionada.",
    );
  }
  async listLotEvents(lotId) {
    return (await this.getLotDetail(lotId)).events;
  }
}

export const dataverse = new DataverseClient();
