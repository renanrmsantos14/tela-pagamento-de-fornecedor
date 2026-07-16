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
const FLOW_RUNTIME_KEY = "VITE_FLOW_SALVAR_ARQUIVOS_ONEDRIVE_URL";
const MAX_PAYMENT_PROOF_SIZE = 5 * 1024 * 1024;
const ERROR_LOG_ENTITY_SET = "new_appmotoristaslogs";
const ERROR_LOG_QUEUE_KEY = "betinhos-pagamentos-error-log-queue-v1";
const MAX_ERROR_LOG_QUEUE = 50;
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
  serviceItemCategory: 100000000,
  activeEmployee: 0,
  activeFavorecido: 100000000,
  inactiveFavorecido: 100000001,
  activeLink: 100000000,
  inactiveLink: 100000001,
  openLot: 100000000,
  cancelledLot: 100000001,
  openPayment: 100000000,
  paidPayment: 100000001,
  documentNotGenerated: 100000000,
  documentSending: 100000001,
  documentSent: 100000002,
  documentFailed: 100000003,
  documentResendRequired: 100000004,
  eventCreated: 100000000,
  eventEmailSent: 100000001,
  eventEmailResent: 100000002,
  eventPaymentRegistered: 100000003,
  eventProofAttached: 100000004,
  eventNotificationFailed: 100000005,
  eventDraftUpdated: 100000006,
  eventCancelled: 100000007,
  eventPaymentReverted: 100000008,
  eventDocumentFailed: 100000009,
});

const EVENT_OPERATION_CHOICES = Object.freeze({
  draft_created: CHOICES.eventCreated,
  draft_updated: CHOICES.eventDraftUpdated,
  cancelled: CHOICES.eventCancelled,
  paid: CHOICES.eventPaymentRegistered,
  paid_reverted: CHOICES.eventPaymentReverted,
  document_sent: CHOICES.eventEmailSent,
  document_failed: CHOICES.eventDocumentFailed,
});
const EVENT_CHOICE_OPERATIONS = Object.freeze({
  [CHOICES.eventCreated]: "draft_created",
  [CHOICES.eventEmailSent]: "document_sent",
  [CHOICES.eventEmailResent]: "document_sent",
  [CHOICES.eventPaymentRegistered]: "paid",
  [CHOICES.eventProofAttached]: "proof_attached",
  [CHOICES.eventNotificationFailed]: "document_failed",
  [CHOICES.eventDraftUpdated]: "draft_updated",
  [CHOICES.eventCancelled]: "cancelled",
  [CHOICES.eventPaymentReverted]: "paid_reverted",
  [CHOICES.eventDocumentFailed]: "document_failed",
});
const eventOperationChoice = (operation, version = 1) =>
  operation === "document_sent" && Number(version) > 1
    ? CHOICES.eventEmailResent
    : EVENT_OPERATION_CHOICES[operation] || CHOICES.eventCreated;

const cleanGuid = (value) => String(value || "").replace(/[{}]/g, "");
const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const parseSnapshot = (value) => {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
};
const runtimeConfig = () => {
  const root = typeof window === "undefined" ? {} : window;
  const config = root.__PAYMENT_RUNTIME_CONFIG || {};
  return {
    oneDriveFlowUrl:
      config.oneDriveFlowUrl ||
      root.__ONEDRIVE_FLOW_URL ||
      root.__PAYMENT_FLOW_URL ||
      "",
  };
};
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao preparar comprovante para envio."));
    reader.readAsDataURL(file);
  });
const sanitizePathSegment = (value, fallback = "arquivo") => {
  const sanitized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || fallback;
};
const localHost = () =>
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localPreviewHost = () =>
  localHost() ||
  (typeof window !== "undefined" && window.location.port === "5192") ||
  import.meta.env?.DEV === true;
const readXrm = (target) => {
  try {
    return target?.Xrm || null;
  } catch {
    return null;
  }
};

const getXrm = () => {
  if (typeof window === "undefined") return null;
  return readXrm(window.parent) || readXrm(window);
};

const directWebResourceClientUrl = () => {
  if (typeof window === "undefined") return "";
  const { location } = window;
  if (!/^\/WebResources\//i.test(location?.pathname || "")) return "";
  return location.origin || "";
};

const resolveDataverseContext = () => {
  const xrm = getXrm();
  const clientUrl = xrm?.Utility?.getGlobalContext?.().getClientUrl?.() || "";
  if (clientUrl) return { xrm, clientUrl, source: "xrm" };

  const directClientUrl = directWebResourceClientUrl();
  return {
    xrm: null,
    clientUrl: directClientUrl,
    source: directClientUrl ? "direct" : "none",
  };
};
const escapeOData = (value) => String(value).replace(/'/g, "''");
const normalizeLabel = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const reservationDetailLabels = Object.freeze({
  dataServico: [
    "data e hor\u00e1rio de sa\u00edda",
    "data/hora de sa\u00edda",
    "data e hora de sa\u00edda",
  ],
  trajeto: ["trajeto", "rota"],
  cliente: ["cliente"],
  motorista: ["motorista"],
  dataFinalizacao: [
    "horário de finalização",
    "data/hora de finalização",
    "data de finalização",
    "finalização",
  ],
  observacaoOperacao: [
    "obs de operação",
    "observação de operação",
    "observações da operação",
  ],
  tipoVeiculo: ["tipo de veículo", "tipo veículo"],
  veiculo: ["veículo"],
  observacaoFinal: ["observação final", "observações finais"],
});
const reservationOperationalMetadataFields = Object.freeze({
  dataServico: "cr40f_dataehorriodesada",
  dataFinalizacao: "new_datadefinalizacao",
  observacaoOperacao: "cr40f_obsdeoperao",
});
const fieldValue = (row, logicalName) =>
  logicalName
    ? row[`${logicalName}@OData.Community.Display.V1.FormattedValue`] ||
      row[logicalName] ||
      ""
    : "";
const rawFieldValue = (row, logicalName) =>
  logicalName ? row[logicalName] || "" : "";
const selectableAttributeName = (attribute) =>
  attribute?.AttributeType === "Lookup"
    ? `_${attribute.LogicalName}_value`
    : attribute?.LogicalName || "";
const errorMessage = (error) =>
  String(error?.message || error || "Erro desconhecido").slice(0, 20000);
const errorStack = (error) => String(error?.stack || "").slice(0, 100000);
const errorLogRecord = (error, context = {}) => {
  const message = errorMessage(error);
  return {
    new_name: `error | Tela Pagamento de Fornecedores | ${message}`.slice(0, 160),
    new_occurredat: now(),
    new_severity: "error",
    new_source: "tela-pagamento-fornecedores",
    new_action: String(context.action || "").slice(0, 180),
    new_phase: String(context.phase || "").slice(0, 120),
    new_component: "DataverseClient",
    new_message: message,
    new_stack: errorStack(error),
    new_errorname: String(error?.name || "Error").slice(0, 220),
    new_errorcode: String(error?.status || error?.code || "").slice(0, 120),
    new_appname: "Tela Pagamento de Fornecedores",
    new_url: String(typeof window === "undefined" ? "" : window.location.href).slice(0, 4000),
    new_useragent: String(typeof navigator === "undefined" ? "" : navigator.userAgent).slice(0, 4000),
    new_language: String(typeof navigator === "undefined" ? "" : navigator.language).slice(0, 80),
    new_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    new_payloadjson: JSON.stringify(context.payload || {}).slice(0, 20000),
  };
};

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
    const status = index % 19 === 0 ? "pendente" : "concluido";
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
      status,
      itemCategory:
        index % 7 === 0
          ? 100000001
          : CHOICES.serviceItemCategory,
      statusLabel: status === "concluido" ? "Concluído" : "Pendente",
      reservationStatus: status,
      reservationStatusLabel:
        status === "concluido" ? "Concluído" : "Pendente",
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
        service.itemCategory === CHOICES.serviceItemCategory &&
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
    const context = resolveDataverseContext();
    this.xrm = context.xrm;
    this.clientUrl = context.clientUrl;
    this.contextSource = context.source;
    this.apiRoot = this.clientUrl
      ? `${this.clientUrl}/api/data/${API_VERSION}`
      : "";
    this.flowUrlCache = new Map();
    this.mockMode = !this.clientUrl && localPreviewHost();
    this.identity = {
      userId: "",
      organizationId: "",
      businessUnitId: "",
    };
    this.cache = new Map();
    this.mock = this.loadMock();
    this.installGlobalErrorLogging();
    void this.flushErrorLogQueue();
    if (this.contextSource === "direct") void this.loadDirectIdentity();
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
  reservationWebresourceUrl(reservationId) {
    const id = cleanGuid(reservationId);
    if (!id) return "";
    const data = encodeURIComponent(
      JSON.stringify({
        mode: "edit",
        entityName: TABLES.reservation,
        id,
        recordId: id,
        entityId: id,
      }),
    );
    return `${this.clientUrl || ""}/main.aspx?pagetype=webresource&webresourceName=new_formulario_geral.html&data=${data}`;
  }

  async loadDirectIdentity() {
    const identity = await this.request("GET", "/WhoAmI").catch(() => null);
    if (!identity) return null;

    this.identity = {
      userId: cleanGuid(identity.UserId),
      organizationId: cleanGuid(identity.OrganizationId),
      businessUnitId: cleanGuid(identity.BusinessUnitId),
    };
    return this.identity;
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
  readErrorLogQueue() {
    try {
      const raw = localStorage.getItem(ERROR_LOG_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  writeErrorLogQueue(records) {
    try {
      localStorage.setItem(
        ERROR_LOG_QUEUE_KEY,
        JSON.stringify(records.slice(-MAX_ERROR_LOG_QUEUE)),
      );
    } catch {
      // Falha de log nunca pode interromper a operação principal.
    }
  }
  async flushErrorLogQueue() {
    if (!this.clientUrl) return;
    const queue = this.readErrorLogQueue();
    if (!queue.length) return;
    const failed = [];
    for (const record of queue) {
      try {
        const response = await fetch(`${this.apiRoot}/${ERROR_LOG_ENTITY_SET}`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(record),
        });
        if (!response.ok) failed.push(record);
      } catch {
        failed.push(record);
      }
    }
    this.writeErrorLogQueue(failed);
  }
  async logError(error, context = {}) {
    const record = errorLogRecord(error, context);
    if (!this.clientUrl) {
      this.writeErrorLogQueue([...this.readErrorLogQueue(), record]);
      return;
    }
    try {
      const response = await fetch(`${this.apiRoot}/${ERROR_LOG_ENTITY_SET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(record),
      });
      if (!response.ok)
        this.writeErrorLogQueue([...this.readErrorLogQueue(), record]);
    } catch {
      this.writeErrorLogQueue([...this.readErrorLogQueue(), record]);
    }
  }
  installGlobalErrorLogging() {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      window.__PAYMENT_ERROR_LOGGER_INSTALLED
    )
      return;
    window.__PAYMENT_ERROR_LOGGER_INSTALLED = true;
    window.addEventListener("error", (event) => {
      void this.logError(event.error || event.message, {
        action: "window.error",
        phase: `${event.filename || ""}:${event.lineno || 0}`,
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      void this.logError(event.reason, { action: "window.unhandledrejection" });
    });
    window.addEventListener("online", () => void this.flushErrorLogQueue());
  }
  async request(method, path, body, headers = {}) {
    if (!this.clientUrl)
      throw new Error(
        "Contexto Dataverse indisponível. Abra o web resource em uma organização autenticada.",
      );
    let response;
    try {
      response = await fetch(
        path.startsWith("http") ? path : `${this.apiRoot}${path}`,
        {
          method,
          credentials: "same-origin",
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
    } catch (error) {
      void this.logError(error, { action: method, phase: path });
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const error = new Error(
        data?.error?.message ||
          data?.Message ||
          data?.raw ||
          `${response.status} ${response.statusText}`,
      );
      error.status = response.status;
      void this.logError(error, { action: method, phase: path });
      throw error;
    }
    return data;
  }
  async getDataverseEnvironmentVariableValue(schemaName) {
    if (this.flowUrlCache.has(schemaName))
      return this.flowUrlCache.get(schemaName);
    const definition = await this.request(
      "GET",
      `/environmentvariabledefinitions?$select=environmentvariabledefinitionid,defaultvalue&$filter=schemaname eq '${escapeOData(schemaName)}'&$top=1`,
    );
    const definitionRow = definition?.value?.[0];
    if (!definitionRow?.environmentvariabledefinitionid) return "";
    const value = await this.request(
      "GET",
      `/environmentvariablevalues?$select=value&$filter=_environmentvariabledefinitionid_value eq ${cleanGuid(definitionRow.environmentvariabledefinitionid)}&$top=1`,
    );
    const url = String(value?.value?.[0]?.value || definitionRow.defaultvalue || "").trim();
    this.flowUrlCache.set(schemaName, url);
    return url;
  }
  async resolveOneDriveFlowUrl() {
    if (this.clientUrl) {
      try {
        const url = await this.getDataverseEnvironmentVariableValue(FLOW_CONTRACT);
        if (url) return url;
      } catch {
        // Mantém fallback de runtime para prévia local e indisponibilidade de metadata.
      }
    }
    const root = typeof window === "undefined" ? {} : window;
    return (
      root.__APP_FLOW_ENV?.[FLOW_RUNTIME_KEY] ||
      runtimeConfig().oneDriveFlowUrl ||
      ""
    );
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
  async lookupSchema(source, logicalName, fallbackLogicalName = "") {
    const key = `${source}:${logicalName}:${fallbackLogicalName}`;
    if (this.cache.has(key)) return this.cache.get(key);
    for (const candidate of [logicalName, fallbackLogicalName].filter(Boolean)) {
      try {
        const data = await this.request(
          "GET",
          `/EntityDefinitions(LogicalName='${escapeOData(source)}')/Attributes(LogicalName='${escapeOData(candidate)}')?$select=LogicalName,SchemaName,AttributeType`,
        );
        if (data?.AttributeType === "Lookup" && data.SchemaName) {
          this.cache.set(key, data.SchemaName);
          return data.SchemaName;
        }
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
    throw new Error(
      `Lookup ${source}.${logicalName} nao encontrado na metadata do Dataverse.`,
    );
  }
  async bindLookup(source, logicalName, target, id, fallbackLogicalName = "") {
    if (!id) return {};
    const [schemaName, entity] = await Promise.all([
      this.lookupSchema(source, logicalName, fallbackLogicalName),
      this.entity(target),
    ]);
    return {
      [`${schemaName}@odata.bind`]: `/${entity.entitySet}(${cleanGuid(id)})`,
    };
  }
  async clearLookup(source, logicalName, fallbackLogicalName = "") {
    const schemaName = await this.lookupSchema(
      source,
      logicalName,
      fallbackLogicalName,
    );
    return { [`${schemaName}@odata.bind`]: null };
  }
  async delete(logicalName, id) {
    const entity = await this.entity(logicalName);
    return this.request("DELETE", `/${entity.entitySet}(${cleanGuid(id)})`);
  }
  normalizePayment(row, entity) {
    const snapshot = parseSnapshot(row?.cr40f_snapshotfavorecido);
    const documentStatus =
      row?.cr40f_statusdocumento === CHOICES.documentSent
        ? DOCUMENT_STATUS.SENT
        : row?.cr40f_statusdocumento === CHOICES.documentFailed
          ? DOCUMENT_STATUS.FAILED
          : row?.cr40f_statusdocumento === CHOICES.documentResendRequired
            ? DOCUMENT_STATUS.RESEND_REQUIRED
            : row?.cr40f_statusdocumento === CHOICES.documentSending
              ? DOCUMENT_STATUS.SENDING
              : DOCUMENT_STATUS.NOT_GENERATED;
    return {
      id: cleanGuid(row?.[entity.id] || row?.cr40f_pagamentoaterceiroid),
      identifier: row?.cr40f_identificadorlote || "Sem identificador",
      lotStatus:
        row?.cr40f_statuslote === CHOICES.cancelledLot
          ? LOT_STATUS.CANCELLED
          : LOT_STATUS.DRAFT,
      paymentStatus:
        row?.cr40f_statuspagamento === CHOICES.paidPayment
          ? PAYMENT_STATUS.PAID
          : PAYMENT_STATUS.OPEN,
      documentStatus,
      version: Number(
        row?.cr40f_documentoversao || row?.cr40f_versaoenvio || 1,
      ),
      year: Number(row?.cr40f_anoreferencia || new Date().getFullYear()),
      favorecidoId: snapshot.id || "",
      favorecidoSnapshot: row?.cr40f_snapshotfavorecido || "{}",
      favorecido: snapshot,
      revenue: Number(row?.cr40f_totalcobradocliente || 0),
      repasse: Number(row?.cr40f_totalrepasse || 0),
      margin: Number(row?.cr40f_margemtotal || 0),
      count: Number(row?.cr40f_quantidadeservicos || 0),
      paidAt: row?.cr40f_pagoem || "",
      proofUrl: row?.cr40f_comprovanteurl || "",
      cancelledAt: row?.cr40f_canceladoem || "",
      documentUrl: row?.cr40f_documentourl || "",
      documentName: row?.cr40f_documentonome || "",
      emailId: row?.cr40f_documentoemailid || "",
      documentError: row?.cr40f_errodocumento || "",
      etag: row?.["@odata.etag"] || "*",
      services: [],
    };
  }
  normalizeItem(row, entity, lot) {
    return {
      id: cleanGuid(row?.[entity.id]),
      paymentId: cleanGuid(row?._cr40f_pagamentoaterceiro_value),
      serviceId:
        cleanGuid(row?._cr40f_composicao_value) ||
        cleanGuid(row?._cr40f_reserva_value),
      compositionId: cleanGuid(row?._cr40f_composicao_value),
      reservationId: cleanGuid(row?._cr40f_reserva_value),
      motoristaId: cleanGuid(row?._cr40f_motoristareferencia_value),
      dataServico: row?.cr40f_dataservico || "",
      trajeto: row?.cr40f_trajeto || "",
      valorCobrado: Number(row?.cr40f_valorcobrado || 0),
      valorRepasse: Number(row?.cr40f_valorrepasse || 0),
      margem: Number(row?.cr40f_margem || 0),
      itemStatus:
        lot.paymentStatus === PAYMENT_STATUS.PAID
          ? ITEM_STATUS.PAID
          : lot.lotStatus === LOT_STATUS.CANCELLED
            ? ITEM_STATUS.CANCELLED
            : ITEM_STATUS.RESERVED,
      snapshotFinanceiro: row?.cr40f_snapshotfinanceiro || "{}",
    };
  }
  normalizeEvent(row, entity) {
    return {
      id: cleanGuid(row?.[entity.id]),
      paymentId: cleanGuid(row?._cr40f_pagamentoaterceiro_value),
      operation:
        row?.cr40f_name ||
        EVENT_CHOICE_OPERATIONS[row?.cr40f_operacao] ||
        String(row?.cr40f_operacao || ""),
      result: row?.cr40f_resultado || "success",
      previous: row?.cr40f_estadoanterior || "",
      next: row?.cr40f_estadonovo || "",
      reason: row?.cr40f_motivo || "",
      message: row?.cr40f_mensagem || "",
      detail: row?.cr40f_detalhetecnico || "",
      version: Number(row?.cr40f_versao || 1),
      documentUrl: row?.cr40f_url || "",
      emailId: row?.cr40f_emailid || "",
      createdAt: row?.cr40f_dataevento || row?.createdon || "",
    };
  }
  async createResolved(logicalName, payload, filter) {
    const entity = await this.entity(logicalName);
    const created = await this.create(logicalName, payload);
    const createdId = cleanGuid(created?.[entity.id] || created?.id);
    if (createdId) return createdId;
    const rows = await this.listAll(
      logicalName,
      `?$select=${entity.id}&$filter=${filter}&$top=2`,
    );
    if (rows.length === 1) return cleanGuid(rows[0][entity.id]);
    throw new Error(
      `Dataverse criou ${logicalName}, mas nao retornou o identificador.`,
    );
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
  async listLots() {
    if (this.mockMode) return clone(this.mock.lots);
    const entity = await this.entity(TABLES.payment);
    const rows = await this.listAll(
      TABLES.payment,
      `?$select=${entity.id},cr40f_statuslote,cr40f_statuspagamento,cr40f_statusdocumento,cr40f_versaoenvio,cr40f_documentoversao,cr40f_anoreferencia,cr40f_identificadorlote,cr40f_quantidadeservicos,cr40f_totalcobradocliente,cr40f_totalrepasse,cr40f_margemtotal,cr40f_pagoem,cr40f_comprovanteurl,cr40f_canceladoem,cr40f_documentourl,cr40f_documentonome,cr40f_documentoemailid,cr40f_errodocumento,cr40f_snapshotfavorecido&$orderby=createdon desc&$top=5000`,
    );
    return rows.map((row) => this.normalizePayment(row, entity));
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
    const payload = {
      cr40f_status: CHOICES.activeLink,
      ...(await this.bindLookup(
        TABLES.link,
        "cr40f_motorista",
        TABLES.employee,
        motoristaId,
      )),
      ...(await this.bindLookup(
        TABLES.link,
        "cr40f_terceirofavorecido",
        TABLES.favorecido,
        favorecidoId,
      )),
    };
    return this.create(TABLES.link, payload);
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
        const metadataAttribute = attributes.find(
          (row) =>
            row.LogicalName === reservationOperationalMetadataFields[key],
        );
        const displayNameAttribute = attributes.find((row) => {
          const label = normalizeLabel(
            row.DisplayName?.UserLocalizedLabel?.Label ||
              row.DisplayName?.LocalizedLabels?.[0]?.Label,
          );
          return labels.some(
            (candidate) => label === normalizeLabel(candidate),
          );
        });
        const attribute = metadataAttribute || displayNameAttribute;
        return [
          key,
          selectableAttributeName(attribute) ||
            reservationOperationalMetadataFields[key] ||
            "",
        ];
      }),
    );
    this.cache.set(cacheKey, resolved);
    return resolved;
  }
  async listReservationStatuses() {
    if (this.mockMode) {
      const options = new Map();
      this.mock.services.forEach((service) => {
        const value = service.reservationStatus || service.status;
        if (value)
          options.set(value, {
            value,
            label: service.reservationStatusLabel || service.statusLabel || value,
            color: service.reservationStatusColor || "",
          });
      });
      return [...options.values()];
    }
    const cacheKey = "reservationStatusOptions";
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const response = await this.request(
      "GET",
      `/EntityDefinitions(LogicalName='${escapeOData(TABLES.reservation)}')/Attributes(LogicalName='cr40f_status')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`,
    ).catch(() => ({}));
    const options = (response.OptionSet?.Options || [])
      .filter((option) => option.Value !== null && option.Value !== undefined)
      .map((option) => ({
        value: String(option.Value),
        label:
          option.Label?.UserLocalizedLabel?.Label ||
          option.Label?.LocalizedLabels?.[0]?.Label ||
          String(option.Value),
        color: option.Color || "",
      }));
    this.cache.set(cacheKey, options);
    return options;
  }
  async compositionReservationLookupValueField() {
    const cacheKey = "compositionReservationLookupValueField";
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const response = await this.request(
      "GET",
      `/EntityDefinitions(LogicalName='${escapeOData(TABLES.composition)}')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,Targets`,
    ).catch(() => ({ value: [] }));
    const lookup = (response.value || []).find((attribute) =>
      attribute.Targets?.includes(TABLES.reservation),
    );
    const field = lookup
      ? `_${lookup.LogicalName}_value`
      : "_cr40f_servicorelacionadogeral_value";
    this.cache.set(cacheKey, field);
    return field;
  }
  async listFinanceServices(filters = {}) {
    if (this.mockMode)
      return clone(
        this.mock.services.filter(
          (row) =>
            row.itemCategory === CHOICES.serviceItemCategory &&
            (!filters.from || row.dataServico >= filters.from) &&
            (!filters.to || row.dataServico.slice(0, 10) <= filters.to) &&
            (!filters.motoristaId || row.motoristaId === filters.motoristaId),
        ),
      );
    const [operationalFields, reservationLookupValueField, reservationEntity] = await Promise.all([
      this.reservationOperationalFields(),
      this.compositionReservationLookupValueField(),
      this.entity(TABLES.reservation),
    ]);
    const reservationFields = [...new Set(Object.values(operationalFields).filter(Boolean))];
    const [compositionRows, reservationRows] = await Promise.all([
      this.listAll(
        TABLES.composition,
        `?$select=cr40f_composicaodeprecosid,cr40f_id,${reservationLookupValueField},new_valortotal,new_status,cr40f_valorrepasseterceiro,_cr40f_terceirofavorecido_value,_cr40f_pagamentoaterceiro_value&$top=5000`,
      ),
      this.listAll(
        TABLES.reservation,
        `?$select=${reservationEntity.id},cr40f_id,cr40f_status,new_categoriadoitem${reservationFields.length ? `,${reservationFields.join(",")}` : ""}&$filter=new_categoriadoitem eq ${CHOICES.serviceItemCategory}&$top=5000`,
      ),
    ]);
    const reservations = new Map(
      reservationRows.map((row) => [
        cleanGuid(row[reservationEntity.id]),
        row,
      ]),
    );
    return compositionRows.flatMap((composition) => {
      const reservationId = cleanGuid(composition[reservationLookupValueField]);
      const reservation = reservations.get(reservationId);
      if (!reservation) return [];
      const formattedStatus =
        composition["new_status@OData.Community.Display.V1.FormattedValue"];
      const statusLabel =
        formattedStatus ||
        (composition.new_status === CHOICES.completedComposition
          ? "Concluído"
          : "Sem status");
      return [{
        id: cleanGuid(composition.cr40f_composicaodeprecosid),
        compositionId: cleanGuid(composition.cr40f_composicaodeprecosid),
        reservationId,
        identificador: reservation.cr40f_id || composition.cr40f_id || "Sem ID",
        dataServico: rawFieldValue(reservation, operationalFields.dataServico),
        dataFinalizacao: rawFieldValue(
          reservation,
          operationalFields.dataFinalizacao,
        ),
        cliente: fieldValue(reservation, operationalFields.cliente),
        trajeto: fieldValue(reservation, operationalFields.trajeto),
        motorista: fieldValue(reservation, operationalFields.motorista),
        motoristaId: cleanGuid(
          operationalFields.motorista
            ? reservation[operationalFields.motorista]
            : "",
        ),
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
        status: normalizeLabel(statusLabel),
        statusLabel,
        itemCategory: reservation.new_categoriadoitem,
        reservationStatus: String(reservation.cr40f_status ?? ""),
        reservationStatusLabel:
          reservation["cr40f_status@OData.Community.Display.V1.FormattedValue"] ||
          String(reservation.cr40f_status ?? ""),
        etag: composition["@odata.etag"] || "*",
      }];
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
    await this.update(
      TABLES.composition,
      serviceId,
      { cr40f_valorrepasseterceiro: Number(value) },
      etag,
    );
    return {
      id: cleanGuid(serviceId),
      valorRepasse: Number(value),
      etag: "*",
    };
  }
  async setPreferredFavorecido(serviceId, favorecidoId, motoristaId = "") {
    if (this.mockMode) {
      const service = this.mock.services.find((row) => row.id === serviceId);
      if (!service) throw new Error("Serviço não encontrado.");
      await this.upsertLink(service.motoristaId, favorecidoId);
      service.favorecidoId = favorecidoId;
      this.persistMock();
      return clone(service);
    }
    if (motoristaId) await this.upsertLink(motoristaId, favorecidoId);
    await this.update(TABLES.composition, serviceId, {
      ...(await this.bindLookup(
        TABLES.composition,
        "cr40f_terceirofavorecido",
        TABLES.favorecido,
        favorecidoId,
      )),
    });
    return { favorecidoId };
  }
  async assignFavorecidoToServices(serviceIds, favorecidoId) {
    const ids = [...new Set(serviceIds.map(cleanGuid).filter(Boolean))];
    if (!ids.length) return [];
    if (this.mockMode) {
      const assigned = [];
      this.mock.services.forEach((service) => {
        if (!ids.includes(service.id) || service.favorecidoId) return;
        service.favorecidoId = favorecidoId;
        assigned.push(clone(service));
      });
      this.persistMock();
      return assigned;
    }
    const payload = await this.bindLookup(
      TABLES.composition,
      "cr40f_terceirofavorecido",
      TABLES.favorecido,
      favorecidoId,
    );
    await Promise.all(
      ids.map((serviceId) =>
        this.update(TABLES.composition, serviceId, payload),
      ),
    );
    return ids.map((id) => ({ id, favorecidoId }));
  }
  async clearFavorecidoFromServices(serviceIds, favorecidoId = "") {
    const ids = [...new Set(serviceIds.map(cleanGuid).filter(Boolean))];
    if (!ids.length) return [];
    if (this.mockMode) {
      const cleared = [];
      this.mock.services.forEach((service) => {
        if (
          !ids.includes(service.id) ||
          (favorecidoId && service.favorecidoId !== favorecidoId)
        )
          return;
        service.favorecidoId = "";
        cleared.push(clone(service));
      });
      this.persistMock();
      return cleared;
    }
    const payload = await this.clearLookup(
      TABLES.composition,
      "cr40f_terceirofavorecido",
    );
    await Promise.all(
      ids.map((serviceId) =>
        this.update(TABLES.composition, serviceId, payload),
      ),
    );
    return ids.map((id) => ({ id, favorecidoId: "" }));
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
  async recordRemoteEvent(paymentId, operation, message, extra = {}) {
    const payload = {
      ...(await this.bindLookup(
        TABLES.event,
        "cr40f_pagamentoaterceiro",
        TABLES.payment,
        paymentId,
      )),
      cr40f_name: operation,
      cr40f_dataevento: now(),
      cr40f_operacao: eventOperationChoice(operation, extra.version),
      cr40f_resultado: extra.result || "success",
      cr40f_estadoanterior: extra.previous || "",
      cr40f_estadonovo: extra.next || "",
      cr40f_motivo: extra.reason || "",
      cr40f_mensagem: message,
      cr40f_detalhetecnico: extra.detail || "",
      cr40f_versao: extra.version || 1,
      cr40f_url: extra.documentUrl || "",
      cr40f_emailid: extra.emailId || "",
    };
    return this.create(TABLES.event, payload);
  }
  async createRemoteItem(paymentId, service) {
    const payload = {
      cr40f_dataservico: service.dataServico || null,
      cr40f_trajeto: service.trajeto || "",
      cr40f_valorcobrado: Number(service.valorCobrado || 0),
      cr40f_valorrepasse: Number(service.valorRepasse || 0),
      cr40f_margem:
        Number(service.valorCobrado || 0) - Number(service.valorRepasse || 0),
      cr40f_snapshotfinanceiro: JSON.stringify(service),
      ...(await this.bindLookup(
        TABLES.item,
        "cr40f_composicao",
        TABLES.composition,
        service.compositionId,
      )),
      ...(await this.bindLookup(
        TABLES.item,
        "cr40f_pagamentoaterceiro",
        TABLES.payment,
        paymentId,
      )),
      ...(await this.bindLookup(
        TABLES.item,
        "cr40f_reserva",
        TABLES.reservation,
        service.reservationId,
      )),
      ...(await this.bindLookup(
        TABLES.item,
        "cr40f_motorista",
        TABLES.employee,
        service.motoristaId,
        "cr40f_motoristareferencia",
      )),
    };
    return this.create(TABLES.item, payload);
  }
  async linkCompositionToLot(service, paymentId, favorecidoId) {
    return this.update(
      TABLES.composition,
      service.compositionId,
      {
        ...(await this.bindLookup(
          TABLES.composition,
          "cr40f_pagamentoaterceiro",
          TABLES.payment,
          paymentId,
        )),
        ...(await this.bindLookup(
          TABLES.composition,
          "cr40f_terceirofavorecido",
          TABLES.favorecido,
          favorecidoId,
        )),
      },
      service.etag || "*",
    );
  }
  async createDraftLot(input) {
    const services = input.services || [];
    if (!services.length) throw new Error("Selecione pelo menos um serviço.");
    const links = await this.listLinks();
    const actual = (await this.listFinanceServices()).filter((row) =>
      services.some((item) => item.id === row.id),
    );
    if (actual.length !== services.length)
      throw new Error(
        "Um ou mais serviÃ§os selecionados foram alterados. Atualize a lista e tente novamente.",
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
    const paymentPayload = {
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
    };
    const paymentId = await this.createResolved(
      TABLES.payment,
      paymentPayload,
      `cr40f_identificadorlote eq '${escapeOData(identifier)}'`,
    );
    const linkedServices = [];
    const createdItems = [];
    try {
      for (const service of actual) {
        await this.linkCompositionToLot(
          service,
          paymentId,
          input.favorecido.id,
        );
        linkedServices.push(service);
        createdItems.push(await this.createRemoteItem(paymentId, service));
      }
      await this.recordRemoteEvent(
        paymentId,
        "draft_created",
        "Lote criado e servicos reservados.",
        { next: "Rascunho", version: 1 },
      );
    } catch (error) {
      await Promise.all(
        linkedServices.map(async (service) => {
          try {
            await this.update(
              TABLES.composition,
              service.compositionId,
              await this.clearLookup(
                TABLES.composition,
                "cr40f_pagamentoaterceiro",
              ),
            );
          } catch {
            // A falha de limpeza nÃ£o deve ocultar o erro original da reserva.
          }
        }),
      );
      const itemEntity = await this.entity(TABLES.item);
      await Promise.all(
        createdItems.map((item) => {
          const itemId = cleanGuid(item?.[itemEntity.id] || item?.id);
          return itemId
            ? this.delete(TABLES.item, itemId).catch(() => undefined)
            : undefined;
        }),
      );
      await this.update(TABLES.payment, paymentId, {
        cr40f_statuslote: CHOICES.cancelledLot,
        cr40f_canceladoem: now(),
        cr40f_motivocancelamento: `Falha ao reservar servicos: ${error.message}`,
      }).catch(() => undefined);
      throw new Error(`Lote ${identifier} criado parcialmente: ${error.message}`);
    }
    return this.getLotDetail(paymentId);
  }
  async updateDraftLot(lotId, input) {
    if (!this.mockMode) {
      const detail = await this.getLotDetail(lotId);
      if (
        detail.lotStatus !== LOT_STATUS.DRAFT ||
        detail.paymentStatus !== PAYMENT_STATUS.OPEN
      )
        throw new Error("Apenas lote em aberto pode ser editado.");
      const favorecido = (await this.listFavorecidos(true)).find(
        (row) => row.id === input.favorecidoId,
      );
      if (!favorecido) throw new Error("Favorecido nao encontrado.");
      const selected = (await this.listFinanceServices()).filter((row) =>
        input.serviceIds.includes(row.id),
      );
      if (!selected.length) throw new Error("Selecione pelo menos um servico.");
      const selectedIds = new Set(selected.map((row) => row.compositionId));
      for (const item of detail.items) {
        if (!item.compositionId || selectedIds.has(item.compositionId)) continue;
        await this.update(
          TABLES.composition,
          item.compositionId,
          await this.clearLookup(
            TABLES.composition,
            "cr40f_pagamentoaterceiro",
          ),
        );
        await this.delete(TABLES.item, item.id);
      }
      for (const service of selected) {
        if (service.pagamentoId && service.pagamentoId !== lotId)
          throw new Error(`${service.identificador} ja esta reservado.`);
        await this.linkCompositionToLot(service, lotId, favorecido.id);
        if (
          !detail.items.some(
            (item) => item.compositionId === service.compositionId,
          )
        )
          await this.createRemoteItem(lotId, service);
      }
      const snapshot = createLotSnapshot(favorecido, selected, input.year);
      await this.update(TABLES.payment, lotId, {
        cr40f_anoreferencia: input.year,
        cr40f_quantidadeservicos: snapshot.count,
        cr40f_totalcobradocliente: snapshot.revenue,
        cr40f_totalrepasse: snapshot.repasse,
        cr40f_margemtotal: snapshot.margin,
        cr40f_emailfavorecidoenvio: favorecido.email,
        cr40f_snapshotfavorecido: snapshot.favorecidoSnapshot,
      });
      await this.recordRemoteEvent(
        lotId,
        "draft_updated",
        "Servicos do rascunho atualizados.",
        { next: "Rascunho", version: detail.version },
      );
      return this.getLotDetail(lotId);
    }
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
    if (!this.mockMode) {
      const detail = await this.getLotDetail(lotId);
      if (
        detail.lotStatus !== LOT_STATUS.DRAFT ||
        detail.paymentStatus !== PAYMENT_STATUS.OPEN
      )
        throw new Error("Apenas lote aberto pode ser cancelado.");
      for (const item of detail.items) {
        if (!item.compositionId) continue;
        await this.update(
          TABLES.composition,
          item.compositionId,
          await this.clearLookup(
            TABLES.composition,
            "cr40f_pagamentoaterceiro",
          ),
        );
      }
      await this.update(TABLES.payment, lotId, {
        cr40f_statuslote: 100000001,
        cr40f_canceladoem: now(),
        cr40f_motivocancelamento: reason,
      });
      await this.recordRemoteEvent(
        lotId,
        "cancelled",
        "Lote cancelado e servicos liberados.",
        {
          previous: "Rascunho",
          next: "Cancelado",
          reason,
          version: detail.version,
        },
      );
      return this.getLotDetail(lotId);
    }
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
    if (!this.mockMode) {
      const detail = await this.getLotDetail(lotId);
      if (
        detail.lotStatus !== LOT_STATUS.DRAFT ||
        detail.paymentStatus !== PAYMENT_STATUS.OPEN
      )
        throw new Error("Lote indisponivel para pagamento.");
      await this.update(TABLES.payment, lotId, {
        cr40f_statuspagamento: 100000001,
        cr40f_statusdocumento: CHOICES.documentSending,
        cr40f_pagoem: now(),
        ...(proofUrl ? { cr40f_comprovanteurl: proofUrl } : {}),
      });
      await this.recordRemoteEvent(
        lotId,
        "paid",
        "Pagamento integral registrado.",
        {
          previous: "Em aberto",
          next: "Pago",
          version: detail.version,
        },
      );
      return this.getLotDetail(lotId);
    }
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
  async uploadPaymentProof(lot, file) {
    if (!file) return null;
    if (file.size > MAX_PAYMENT_PROOF_SIZE)
      throw new Error("O comprovante deve ter no máximo 5 MB.");
    const fileName = sanitizePathSegment(file.name, "comprovante");
    const path = `Pagamentos a Terceiros/${lot.year}/${sanitizePathSegment(lot.favorecido?.nome, "Favorecido")}/${sanitizePathSegment(lot.identifier)}/Comprovantes`;
    if (this.mockMode)
      return {
        url: `https://onedrive.local/${encodeURIComponent(fileName)}`,
        name: fileName,
      };
    const dataUri = await fileToDataUrl(file);
    const payload = {
      caminhoCompleto: path,
      nomeArquivo: fileName,
      conteudoBase64: dataUri.split(",")[1] || "",
      mimeType: file.type || "application/octet-stream",
      metadados: {
        loteId: lot.id,
        identificadorLote: lot.identifier,
        tipo: "COMPROVANTE_PAGAMENTO",
        contrato: FLOW_CONTRACT,
      },
    };
    if (!payload.conteudoBase64) throw new Error("Comprovante vazio para envio.");
    const endpoint = await this.resolveOneDriveFlowUrl();
    if (!endpoint) throw new Error("URL do Flow de OneDrive não configurada.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok)
      throw new Error(data?.message || data?.error || `Flow OneDrive retornou ${response.status}.`);
    const url = data?.webUrl || data?.url || data?.link;
    if (!url) throw new Error("Flow OneDrive nao retornou URL do comprovante.");
    return { url, name: fileName };
  }
  async revertPaid(lotId, reason) {
    if (!String(reason || "").trim())
      throw new Error("Informe o motivo da reversão.");
    if (!this.mockMode) {
      const detail = await this.getLotDetail(lotId);
      if (detail.paymentStatus !== PAYMENT_STATUS.PAID)
        throw new Error("Lote nao esta pago.");
      await this.update(TABLES.payment, lotId, {
        cr40f_statuspagamento: 100000000,
        cr40f_pagamentorevertidoem: now(),
        cr40f_motivoreversaopagamento: reason,
        cr40f_statusdocumento: CHOICES.documentResendRequired,
        cr40f_versaoenvio: detail.version + 1,
      });
      await this.recordRemoteEvent(
        lotId,
        "paid_reverted",
        "Pagamento revertido; novo documento sera obrigatorio.",
        {
          previous: "Pago",
          next: "Em aberto",
          reason,
          version: detail.version + 1,
        },
      );
      return this.getLotDetail(lotId);
    }
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
    const endpoint = await this.resolveOneDriveFlowUrl();
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
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok)
      throw new Error(
        data?.message ||
          data?.error ||
          `Flow OneDrive retornou ${response.status}.`,
      );
    if (!data || (!data.webUrl && !data.url && !data.link))
      throw new Error("Flow OneDrive nao retornou URL do documento.");
    return { ...data, url: data.webUrl || data.url || data.link };
  }
  async registerDocumentResult(lotId, result) {
    if (!this.mockMode) {
      const detail = await this.getLotDetail(lotId);
      await this.update(TABLES.payment, lotId, {
        cr40f_statusdocumento: result.ok
          ? CHOICES.documentSent
          : CHOICES.documentFailed,
        cr40f_documentourl: result.url || null,
        cr40f_documentonome: result.name || null,
        cr40f_documentoemailid: null,
        cr40f_errodocumento: result.error || null,
      });
      await this.recordRemoteEvent(
        lotId,
        result.ok ? "document_sent" : "document_failed",
        result.ok
          ? "PDF salvo no OneDrive."
          : "Falha ao gerar ou salvar documento.",
        {
          result: result.ok ? "success" : "failure",
          version: detail.version,
          documentUrl: result.url || "",
          detail: result.error || "",
        },
      );
      return this.getLotDetail(lotId);
    }
    const lot = this.mock.lots.find((row) => row.id === lotId);
    lot.documentStatus = result.ok
      ? DOCUMENT_STATUS.SENT
      : DOCUMENT_STATUS.FAILED;
    lot.documentUrl = result.url || lot.documentUrl || "";
    lot.documentName = result.name || lot.documentName || "";
    lot.emailId = "";
    lot.documentError = result.error || "";
    this.addEvent(
      lotId,
      result.ok ? "document_sent" : "document_failed",
      result.ok
        ? "PDF salvo no OneDrive."
        : "Falha ao gerar ou salvar documento.",
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
    if (this.mockMode) {
      const lot = this.mock.lots.find((row) => row.id === lotId);
      if (!lot) throw new Error("Lote nao encontrado.");
      return {
        ...clone(lot),
        items: clone(this.mock.items.filter((row) => row.paymentId === lotId)),
        events: clone(
          this.mock.events.filter((row) => row.paymentId === lotId),
        ),
      };
    }
    const paymentEntity = await this.entity(TABLES.payment);
    const paymentRows = await this.listAll(
      TABLES.payment,
      `?$select=${paymentEntity.id},cr40f_statuslote,cr40f_statuspagamento,cr40f_statusdocumento,cr40f_versaoenvio,cr40f_documentoversao,cr40f_anoreferencia,cr40f_identificadorlote,cr40f_quantidadeservicos,cr40f_totalcobradocliente,cr40f_totalrepasse,cr40f_margemtotal,cr40f_pagoem,cr40f_comprovanteurl,cr40f_canceladoem,cr40f_documentourl,cr40f_documentonome,cr40f_documentoemailid,cr40f_errodocumento,cr40f_snapshotfavorecido&$filter=${paymentEntity.id} eq ${cleanGuid(lotId)}&$top=1`,
    );
    const paymentRow = paymentRows[0];
    if (!paymentRow) throw new Error("Lote nao encontrado.");
    const lot = this.normalizePayment(paymentRow, paymentEntity);
    const itemEntity = await this.entity(TABLES.item);
    const eventEntity = await this.entity(TABLES.event);
    const [itemRows, eventRows] = await Promise.all([
      this.listAll(
        TABLES.item,
        `?$select=${itemEntity.id},_cr40f_composicao_value,_cr40f_pagamentoaterceiro_value,_cr40f_reserva_value,_cr40f_motoristareferencia_value,cr40f_dataservico,cr40f_trajeto,cr40f_valorcobrado,cr40f_valorrepasse,cr40f_margem,cr40f_snapshotfinanceiro&$filter=_cr40f_pagamentoaterceiro_value eq ${cleanGuid(lotId)}&$orderby=cr40f_dataservico asc&$top=5000`,
      ),
      this.listAll(
        TABLES.event,
        `?$select=${eventEntity.id},_cr40f_pagamentoaterceiro_value,cr40f_name,cr40f_dataevento,cr40f_operacao,cr40f_resultado,cr40f_estadoanterior,cr40f_estadonovo,cr40f_motivo,cr40f_mensagem,cr40f_detalhetecnico,cr40f_versao,cr40f_url,cr40f_emailid&$filter=_cr40f_pagamentoaterceiro_value eq ${cleanGuid(lotId)}&$orderby=cr40f_dataevento desc&$top=5000`,
      ),
    ]);
    const items = itemRows.map((row) =>
      this.normalizeItem(row, itemEntity, lot),
    );
    return {
      ...lot,
      items,
      services: items,
      events: eventRows.map((row) => this.normalizeEvent(row, eventEntity)),
    };
  }
  async listLotEvents(lotId) {
    return (await this.getLotDetail(lotId)).events;
  }
}

export const dataverse = new DataverseClient();
