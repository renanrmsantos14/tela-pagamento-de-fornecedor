import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Columns3,
  FileDown,
  FileText,
  Link2,
  LayoutDashboard,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  GripVertical,
  Plus,
  RefreshCw,
  Rows3,
  RotateCcw,
  Save,
  Search,
  Send,
  TableProperties,
  Undo2,
  UsersRound,
  X,
} from "lucide-react";
import { dataverse } from "./lib/dataverse";
import { buildPaymentPdf } from "./lib/document";
import SearchableSelect, { SearchableMultiSelect } from "./SearchableSelect";
import {
  DOCUMENT_STATUS,
  LOT_STATUS,
  PAYMENT_STATUS,
  canCancel,
  canPay,
  canRevert,
  eligibleServices,
  money,
  moneyInput,
  marginPercent,
  parseMoney,
  paymentTotals,
  validateFavorecido,
} from "./domain/payment";

const monthRange = () => {
  const date = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
};
const toDateInput = (date) => date.toISOString().slice(0, 10);
const previousRange = (range) => {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const days = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1,
  );
  const previousTo = new Date(from);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - days + 1);
  return { from: toDateInput(previousFrom), to: toDateInput(previousTo) };
};
const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};
const dashboardBuckets = (services, range) => {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const totalDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1,
  );
  const bucketCount = Math.min(6, Math.max(1, Math.ceil(totalDays / 7)));
  const bucketDays = Math.ceil(totalDays / bucketCount);
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = new Date(from);
    start.setDate(start.getDate() + index * bucketDays);
    const end = new Date(start);
    end.setDate(end.getDate() + bucketDays - 1);
    if (end > to) end.setTime(to.getTime());
    const rows = services.filter((service) => {
      const date = new Date(service.dataServico);
      return date >= start && date <= end;
    });
    return {
      label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...paymentTotals(rows),
    };
  });
};
const dashboardRanking = (services, key, nameFor) => {
  const grouped = new Map();
  services.forEach((service) => {
    const id = service[key] || "sem-vinculo";
    const current = grouped.get(id) || { id, name: nameFor(service), services: [] };
    current.services.push(service);
    grouped.set(id, current);
  });
  return [...grouped.values()]
    .map((row) => ({ ...row, ...paymentTotals(row.services) }))
    .sort((left, right) => right.margin - left.margin)
    .slice(0, 5);
};
const statusText = (lot) =>
  lot.lotStatus === LOT_STATUS.CANCELLED
    ? "Cancelado"
    : lot.paymentStatus === PAYMENT_STATUS.PAID
      ? lot.documentStatus === DOCUMENT_STATUS.SENT
        ? "Pago · documento enviado"
        : lot.documentStatus === DOCUMENT_STATUS.FAILED
          ? "Pago · falha documental"
          : "Pago · documento pendente"
      : "Rascunho";
const formatServiceDate = (value, fallback = "") => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;
  const pad = (number) => String(number).padStart(2, "0");
  return [
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(" ");
};
const REPASSE_DEFAULT_STATUS_LABELS = [
  "concluido",
  "cancelado com ressalvas",
];
const normalizeFilterLabel = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const maskPix = (value) =>
  value?.length > 8 ? `${value.slice(0, 3)}••••${value.slice(-3)}` : value;
const REPASSE_COLUMNS = [
  { id: "identificador", label: "Serviço", width: 150, locked: true },
  { id: "valorCobrado", label: "Total CP", width: 135, locked: true },
  { id: "valorRepasse", label: "Repasse", width: 140, locked: true },
  { id: "dataServico", label: "Data e hora", width: 150 },
  { id: "dataFinalizacao", label: "Finalização", width: 150 },
  { id: "motorista", label: "Motorista", width: 170 },
  { id: "trajeto", label: "Trajeto", width: 220 },
  { id: "tipoVeiculo", label: "Tipo de veículo", width: 155 },
  { id: "veiculo", label: "Veículo", width: 175 },
  { id: "cliente", label: "Cliente", width: 180 },
  { id: "observacaoOperacao", label: "Observação operacional", width: 260 },
  { id: "observacaoFinal", label: "Observação final", width: 240 },
  { id: "favorecido", label: "Favorecido", width: 180 },
];
const REPASSE_COLUMNS_STORAGE_KEY = "betinhos_repasses_columns_v3";
const REPASSE_DENSITY_STORAGE_KEY = "betinhos_repasses_density_v1";
const REPASSE_VIEWS_STORAGE_KEY = "betinhos_repasses_views_v1";
const REPASSE_ACTIVE_VIEW_STORAGE_KEY = "betinhos_repasses_active_view_v1";
const loadRepasseColumns = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(REPASSE_COLUMNS_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return viewColumns(saved);
  } catch {
    /* Usa a configuração padrão. */
  }
  return REPASSE_COLUMNS.map((column) => ({ ...column, visible: true }));
};
const loadRepasseDensity = () =>
  localStorage.getItem(REPASSE_DENSITY_STORAGE_KEY) === "compact"
    ? "compact"
    : "comfortable";
const loadRepasseViews = () => {
  try {
    const views = JSON.parse(localStorage.getItem(REPASSE_VIEWS_STORAGE_KEY));
    return Array.isArray(views) ? views : [];
  } catch {
    return [];
  }
};
const loadActiveRepasseView = () =>
  localStorage.getItem(REPASSE_ACTIVE_VIEW_STORAGE_KEY) || "";
const orderRepasseColumns = (columns) => [
  ...columns.filter((column) => column.locked),
  ...columns.filter((column) => !column.locked),
];
const viewColumns = (savedColumns) => {
  const defaults = new Map(REPASSE_COLUMNS.map((column) => [column.id, column]));
  const saved = Array.isArray(savedColumns) ? savedColumns : [];
  const mapped = saved
    .filter((column) => defaults.has(column.id))
    .map((column) => {
      const fallback = defaults.get(column.id);
      return {
        ...fallback,
        width: Math.max(110, Number(column.width) || fallback.width),
        visible: column.visible !== false,
        locked:
          typeof column.locked === "boolean" ? column.locked : fallback.locked,
      };
    });
  const present = new Set(mapped.map((column) => column.id));
  return orderRepasseColumns([
    ...mapped,
    ...REPASSE_COLUMNS.filter((column) => !present.has(column.id)).map(
      (column) => ({ ...column, visible: true }),
    ),
  ]);
};

function Drawer({ title, subtitle, children, onClose, wide = false }) {
  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <section
        className={`drawer ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span>{subtitle}</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>
  );
}
function Badge({ tone = "neutral", children }) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}
function ServiceIdentifierLink({ identifier, reservationId }) {
  const href = dataverse.reservationWebresourceUrl(reservationId);
  if (!href) return <span>{identifier}</span>;
  return (
    <a
      className="service-identifier-link"
      href={href}
      target="_top"
      title={`Abrir serviço ${identifier}`}
      aria-label={`Abrir serviço ${identifier}`}
      onClick={(event) => event.stopPropagation()}
    >
      {identifier}
    </a>
  );
}
export default function App() {
  const [services, setServices] = useState([]);
  const [previousServices, setPreviousServices] = useState([]);
  const [favorecidos, setFavorecidos] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [links, setLinks] = useState([]);
  const [lots, setLots] = useState([]);
  const [reservationStatusOptions, setReservationStatusOptions] = useState([]);
  const [tab, setTab] = useState("overview");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [range, setRange] = useState(monthRange);
  const [search, setSearch] = useState("");
  const [driverIds, setDriverIds] = useState([]);
  const [favorecidoIds, setFavorecidoIds] = useState([]);
  const [saving, setSaving] = useState({});
  const [autosaveErrors, setAutosaveErrors] = useState({});
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lotDetail, setLotDetail] = useState(null);
  const [preselected, setPreselected] = useState(new Set());
  const refreshInFlightRef = useRef(false);
  const busy = (key) => Boolean(saving[key]);
  const setBusy = (key, value) =>
    setSaving((current) => ({ ...current, [key]: value }));
  const setAutosaveError = (key, error) =>
    setAutosaveErrors((current) => {
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  async function refresh() {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setBusy("refresh", true);
    try {
      const [serviceRows, previousServiceRows, favorecidoRows, driverRows, linkRows, lotRows, statusRows] =
        await Promise.all([
          dataverse.listFinanceServices(range),
          dataverse.listFinanceServices(previousRange(range)),
          dataverse.listFavorecidos(true),
          dataverse.listDrivers(),
          dataverse.listLinks(),
          dataverse.listLots(),
          dataverse.listReservationStatuses(),
        ]);
      setServices(serviceRows);
      setPreviousServices(previousServiceRows);
      setFavorecidos(favorecidoRows);
      setDrivers(driverRows);
      setLinks(linkRows);
      setLots(lotRows);
      setReservationStatusOptions(statusRows);
    } catch (err) {
      setError(err.message);
    } finally {
      refreshInFlightRef.current = false;
      setBusy("refresh", false);
    }
  }
  useEffect(() => {
    refresh();
  }, [range.from, range.to]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  const activeFavorecidos = favorecidos.filter((row) => row.status === "ativo");
  const visibleServices = useMemo(
    () =>
      services.filter(
        (service) =>
          (!driverIds.length || driverIds.includes(service.motoristaId)) &&
          (!favorecidoIds.length || favorecidoIds.includes(service.favorecidoId)) &&
          (!search ||
            `${service.identificador} ${service.motorista} ${service.trajeto}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [services, driverIds, favorecidoIds, search],
  );
  const openLot = async (lot) => {
    try {
      const detail = await dataverse.getLotDetail(lot.id);
      setLotDetail(detail);
      setDrawer({ type: "lotDetail" });
    } catch (err) {
      setError(err.message);
    }
  };
  async function saveRepasse(service, raw) {
    const value = parseMoney(raw);
    if (value === service.valorRepasse) return;
    setBusy(`repasse-${service.id}`, true);
    try {
      const saved = await dataverse.saveServiceRepasse(
        service.id,
        value,
        service.etag,
      );
      setServices((rows) =>
        rows.map((row) => (row.id === service.id ? { ...row, ...saved } : row)),
      );
      return saved;
    } catch (err) {
      const isConcurrencyConflict =
        err.status === 412 ||
        /rowversion|version of the existing record/i.test(err.message || "");
      if (isConcurrencyConflict) {
        let currentService;
        try {
          currentService = (await dataverse.listFinanceServices(range)).find(
            (row) => row.id === service.id,
          );
        } catch {
          currentService = null;
        }
        if (currentService)
          setServices((rows) =>
            rows.map((row) =>
              row.id === service.id ? { ...row, ...currentService } : row,
            ),
          );
        const conflictError = new Error(
          currentService
            ? "Registro alterado por outro processo. Valor atual recarregado; revise antes de salvar novamente."
            : "Registro alterado ou removido por outro processo. Atualize a tela.",
        );
        conflictError.status = 412;
        throw conflictError;
      }
      throw err;
    } finally {
      setBusy(`repasse-${service.id}`, false);
    }
  }
  async function linkService(service, favorecidoId) {
    const saveKey = `link-${service.id}`;
    const previousFavorecidoId = service.favorecidoId;
    const isSelectedLink = (link) =>
      link.motoristaId === service.motoristaId &&
      link.favorecidoId === favorecidoId;
    const previousLink = links.find(
      isSelectedLink,
    );
    const optimisticLink = previousLink || {
      id: `pending-link-${service.id}-${favorecidoId}`,
      motoristaId: service.motoristaId,
      favorecidoId,
      status: "ativo",
    };
    setAutosaveError(saveKey, null);
    setBusy(saveKey, true);
    setServices((rows) =>
      rows.map((row) =>
        row.id === service.id ? { ...row, favorecidoId } : row,
      ),
    );
    setLinks((rows) =>
      previousLink
        ? rows.map((link) =>
            link.id === previousLink.id ? { ...link, status: "ativo" } : link,
          )
        : [...rows, optimisticLink],
    );
    try {
      const saved = await dataverse.setPreferredFavorecido(
        service.id,
        favorecidoId,
        service.motoristaId,
      );
      setServices((rows) =>
        rows.map((row) =>
          row.id === service.id ? { ...row, ...saved, favorecidoId } : row,
        ),
      );
      const refreshedLinks = await dataverse.listLinks();
      setLinks((rows) => {
        const confirmedLink = refreshedLinks.find(
          (link) => isSelectedLink(link) && link.status === "ativo",
        );
        if (confirmedLink) return refreshedLinks;
        const currentLink = rows.find(isSelectedLink) || optimisticLink;
        return [
          ...refreshedLinks.filter((link) => !isSelectedLink(link)),
          { ...currentLink, status: "ativo" },
        ];
      });
      setPreselected((current) => new Set(current).add(service.id));
      setNotice("Vínculo criado e serviço pré-selecionado.");
    } catch (err) {
      setServices((rows) =>
        rows.map((row) =>
          row.id === service.id
            ? { ...row, favorecidoId: previousFavorecidoId }
            : row,
        ),
      );
      setLinks((rows) =>
        previousLink
          ? rows.map((link) =>
              link.id === previousLink.id ? previousLink : link,
            )
          : rows.filter((link) => link.id !== optimisticLink.id),
      );
      setAutosaveError(saveKey, { message: err.message, favorecidoId });
      setError(err.message);
    } finally {
      setBusy(saveKey, false);
    }
  }
  async function createLot(input) {
    setBusy("lot", true);
    try {
      const created = await dataverse.createDraftLot(input);
      setPreselected(new Set());
      setNotice(`${created.identifier} reservado.`);
      setDrawer(null);
      await refresh();
      await openLot(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("lot", false);
    }
  }
  async function updateLot(lot, input) {
    setBusy("lot", true);
    try {
      const updated = await dataverse.updateDraftLot(lot.id, {
        favorecidoId: input.favorecido.id,
        serviceIds: input.services.map((service) => service.id),
        year: input.year,
      });
      setDrawer(null);
      setNotice(`${updated.identifier} atualizado.`);
      await refresh();
      await openLot(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("lot", false);
    }
  }
  async function runDocument(lot) {
    setBusy(`document-${lot.id}`, true);
    try {
      const detail = await dataverse.getLotDetail(lot.id);
      const pdf = buildPaymentPdf(detail, detail.items);
      const upload = await dataverse.saveDocumentToOneDrive(detail, pdf);
      const email = await dataverse.sendEmailWithPdf(detail, pdf);
      const updated = await dataverse.registerDocumentResult(lot.id, {
        ok: true,
        url: upload.url || upload.link,
        name: upload.name || pdf.name,
        emailId: email.id,
      });
      setLotDetail(await dataverse.getLotDetail(updated.id));
      setNotice("PDF salvo e enviado por e-mail.");
    } catch (err) {
      await dataverse
        .registerDocumentResult(lot.id, { ok: false, error: err.message })
        .catch(() => undefined);
      setLotDetail(await dataverse.getLotDetail(lot.id).catch(() => lotDetail));
      setError(err.message);
    } finally {
      setBusy(`document-${lot.id}`, false);
    }
  }
  async function markPaid(lot, proofInput = {}) {
    setBusy(`pay-${lot.id}`, true);
    try {
      const proof = proofInput.file
        ? await dataverse.uploadPaymentProof(lot, proofInput.file)
        : null;
      const proofUrl = proof?.url || proofInput.url || "";
      const paid = await dataverse.markPaid(lot.id, proofUrl);
      setLotDetail(await dataverse.getLotDetail(paid.id));
      setNotice("Pagamento registrado. Gerando documento.");
      await runDocument(paid);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(`pay-${lot.id}`, false);
    }
  }
  async function reasonAction(action, reason) {
    setBusy(`${action.type}-${action.lot.id}`, true);
    try {
      if (action.type === "cancel")
        await dataverse.cancelLot(action.lot.id, reason);
      else await dataverse.revertPaid(action.lot.id, reason);
      setDrawer(null);
      setLotDetail(null);
      setNotice(
        action.type === "cancel"
          ? "Lote cancelado e serviços liberados."
          : "Pagamento revertido.",
      );
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(`${action.type}-${action.lot.id}`, false);
    }
  }
  async function resetMock() {
    dataverse.resetMock();
    setNotice("Dados locais resetados.");
    await refresh();
  }
  if (!dataverse.available)
    return (
      <main className="connection-error">
        <AlertTriangle size={38} />
        <h1>Pagamentos a Terceiros</h1>
        <p>Abra dentro do model-driven app ou use a prévia local.</p>
      </main>
    );
  const isRefreshing = busy("refresh");
  return (
    <div className={`app-shell ${sidebarExpanded ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
          aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
          title={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
        >
          {sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <Brand />
        <Nav tab={tab} onChange={setTab} />
        <button
          className="primary-button sidebar-create"
          title="Novo lote"
          onClick={() => setDrawer({ type: "lot" })}
        >
          <Plus size={16} />
          Novo lote
        </button>
        <div className="sidebar-foot">
          <span
            className="connection-dot mock"
            title={dataverse.mockMode ? "Modo local completo" : "Dataverse conectado"}
          />
          <div>
            <strong>{dataverse.environmentLabel}</strong>
            <span>
              {dataverse.mockMode
                ? "modo local completo"
                : "Dataverse conectado"}
            </span>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="mobile-header">
          <div className="brand-mark">
            <Banknote size={18} />
          </div>
          <strong>Pagamentos a Terceiros</strong>
          <button
            className="icon-button"
            onClick={refresh}
            aria-label="Atualizar"
            title={isRefreshing ? "Atualizando dados" : "Atualizar dados"}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
          >
            <RefreshCw size={17} className={isRefreshing ? "spin" : ""} />
          </button>
        </header>
        <div className="content-wrap">
          <div className="desktop-actions" aria-label="Ações do ambiente">
            <span className="environment-pill">
              {dataverse.environmentLabel}
            </span>
            <button
              className="icon-button"
              onClick={resetMock}
              disabled={!dataverse.mockMode}
            >
              Resetar mock
            </button>
            <button
              className="icon-button"
              onClick={refresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
              {isRefreshing ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
          {isRefreshing && (
            <div
              className="data-refresh-indicator"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <RefreshCw size={16} className="spin" aria-hidden="true" />
              <span>Atualizando dados desta tela</span>
              <small>Navegação continua disponível</small>
            </div>
          )}
          {error && (
            <Alert tone="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {notice && <Alert tone="success">{notice}</Alert>}
          {tab === "overview" && (
            <OverviewView
              services={services}
              previousServices={previousServices}
              lots={lots}
              links={links}
              favorecidos={favorecidos}
              drivers={drivers}
              range={range}
              setRange={setRange}
              driverIds={driverIds}
              setDriverIds={setDriverIds}
              favorecidoIds={favorecidoIds}
              setFavorecidoIds={setFavorecidoIds}
              onNavigate={setTab}
              onNewLot={() => setDrawer({ type: "lot" })}
              onNewFavorecido={() => setDrawer({ type: "favorecido" })}
            />
          )}
          {tab === "payments" && (
            <PaymentsView
              services={visibleServices}
              drivers={drivers}
              favorecidos={activeFavorecidos}
              allFavorecidos={favorecidos}
              links={links}
              range={range}
              setRange={setRange}
              search={search}
              setSearch={setSearch}
              driverIds={driverIds}
              setDriverIds={setDriverIds}
              favorecidoIds={favorecidoIds}
              setFavorecidoIds={setFavorecidoIds}
              reservationStatusOptions={reservationStatusOptions}
              busy={busy}
              autosaveErrors={autosaveErrors}
              onSaveRepasse={saveRepasse}
              onLink={linkService}
              onGenerateLot={(selectedServices) => {
                if (!selectedServices.length) return;
                setPreselected(new Set(selectedServices.map((service) => service.id)));
                setDrawer({
                  type: "lot",
                  favorecidoId: selectedServices[0].favorecidoId,
                });
              }}
            />
          )}
          {tab === "lots" && (
            <LotsView
              lots={lots}
              onNew={() => setDrawer({ type: "lot" })}
              onOpen={openLot}
            />
          )}
          {tab === "favorecidos" && (
            <FavorecidosView
              favorecidos={favorecidos}
              drivers={drivers}
              links={links}
              onNew={() => setDrawer({ type: "favorecido" })}
              onEdit={(favorecido) =>
                setDrawer({ type: "favorecido", favorecido })
              }
              onLinks={(favorecido) => setDrawer({ type: "links", favorecido })}
              onStatus={async (row) => {
                await dataverse.setFavorecidoStatus(
                  row.id,
                  row.status === "ativo" ? "inativo" : "ativo",
                );
                await refresh();
              }}
            />
          )}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          <LayoutDashboard size={18} />
          <span>Visão geral</span>
        </button>
        <button
          className={tab === "payments" ? "active" : ""}
          onClick={() => setTab("payments")}
        >
          <CircleDollarSign size={18} />
          <span>Repasses</span>
        </button>
        <button
          className={tab === "lots" ? "active" : ""}
          onClick={() => setTab("lots")}
        >
          <ClipboardList size={18} />
          <span>Lotes</span>
        </button>
        <button
          className={tab === "favorecidos" ? "active" : ""}
          onClick={() => setTab("favorecidos")}
        >
          <UsersRound size={18} />
          <span>Terceiros</span>
        </button>
      </nav>
      {drawer?.type === "favorecido" && (
        <FavorecidoDrawer
          favorecido={drawer.favorecido}
          saving={busy("favorecido")}
          onClose={() => setDrawer(null)}
          onSave={async (form) => {
            setBusy("favorecido", true);
            try {
              if (drawer.favorecido) {
                await dataverse.updateFavorecido(drawer.favorecido.id, form);
              } else {
                await dataverse.createFavorecido(form);
              }
              setDrawer(null);
              setNotice(
                drawer.favorecido
                  ? "Terceiro Favorecido atualizado."
                  : "Terceiro Favorecido cadastrado.",
              );
              await refresh();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy("favorecido", false);
            }
          }}
        />
      )}
      {drawer?.type === "links" && (
        <LinksDrawer
          favorecido={drawer.favorecido}
          drivers={drivers}
          links={links}
          saving={busy("link-drawer")}
          onClose={() => setDrawer(null)}
          onSave={async (id) => {
            setBusy("link-drawer", true);
            try {
              await dataverse.upsertLink(id, drawer.favorecido.id);
              await refresh();
              setNotice("Vinculo criado.");
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy("link-drawer", false);
            }
          }}
          onDeactivate={async (id) => {
            setBusy("link-drawer", true);
            try {
              await dataverse.setLinkStatus(id, "inativo");
              await refresh();
              setNotice("Vinculo inativado.");
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy("link-drawer", false);
            }
          }}
        />
      )}
      {(drawer?.type === "lot" || drawer?.type === "editLot") && (
        <LotDrawer
          favorecidos={activeFavorecidos}
          services={services}
          links={links}
          range={range}
          preselected={preselected}
          initialFavorecidoId={drawer.favorecidoId}
          existingLot={drawer.lot}
          saving={busy("lot")}
          onClose={() => setDrawer(null)}
          onSave={(input) =>
            drawer.lot ? updateLot(drawer.lot, input) : createLot(input)
          }
        />
      )}
      {drawer?.type === "lotDetail" && lotDetail && (
        <LotDetailDrawer
          lot={lotDetail}
          busy={busy}
          onClose={() => setDrawer(null)}
          onPay={markPaid}
          onSend={runDocument}
          onEdit={() => setDrawer({ type: "editLot", lot: lotDetail })}
          onCancel={() =>
            setDrawer({
              type: "reason",
              action: { type: "cancel", lot: lotDetail },
            })
          }
          onRevert={() =>
            setDrawer({
              type: "reason",
              action: { type: "revert", lot: lotDetail },
            })
          }
        />
      )}
      {drawer?.type === "reason" && (
        <ReasonDrawer
          action={drawer.action}
          saving={busy(`${drawer.action.type}-${drawer.action.lot.id}`)}
          onClose={() => setDrawer({ type: "lotDetail" })}
          onSave={reasonAction}
        />
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand-block">
      <div className="brand-mark">
        <Banknote size={21} />
      </div>
      <div>
        <strong>Betinhos</strong>
        <span>Financeiro operacional</span>
      </div>
    </div>
  );
}
function Nav({ tab, onChange }) {
  return (
    <nav className="main-nav">
      <button
        className={tab === "overview" ? "active" : ""}
        onClick={() => onChange("overview")}
        title="Visão geral"
      >
        <LayoutDashboard size={17} />
        <span>Visão geral</span>
      </button>
      <button
        className={tab === "payments" ? "active" : ""}
        onClick={() => onChange("payments")}
        title="Lançar repasses"
      >
        <CircleDollarSign size={17} />
        <span>Lançar repasses</span>
      </button>
      <button
        className={tab === "lots" ? "active" : ""}
        onClick={() => onChange("lots")}
        title="Lotes de pagamento"
      >
        <ClipboardList size={17} />
        <span>Lotes de pagamento</span>
      </button>
      <button
        className={tab === "favorecidos" ? "active" : ""}
        onClick={() => onChange("favorecidos")}
        title="Terceiros favorecidos"
      >
        <UsersRound size={17} />
        <span>Terceiros Favorecidos</span>
      </button>
    </nav>
  );
}
function Alert({ tone, children, onClose }) {
  return (
    <div className={`global-alert ${tone}`}>
      <CheckCircle2 size={17} />
      <span>{children}</span>
      {onClose && <button onClick={onClose}>×</button>}
    </div>
  );
}
function OverviewView({
  services,
  previousServices,
  lots,
  links,
  favorecidos,
  drivers,
  range,
  setRange,
  driverIds,
  setDriverIds,
  favorecidoIds,
  setFavorecidoIds,
  onNavigate,
  onNewLot,
  onNewFavorecido,
}) {
  const matchesDashboardFilter = (service) =>
    (!driverIds.length || driverIds.includes(service.motoristaId)) &&
    (!favorecidoIds.length || favorecidoIds.includes(service.favorecidoId));
  const completedServices = services.filter(
    (service) => service.status === "concluido" && matchesDashboardFilter(service),
  );
  const previousCompletedServices = previousServices.filter(
    (service) => service.status === "concluido" && matchesDashboardFilter(service),
  );
  const totals = paymentTotals(completedServices);
  const previousTotals = paymentTotals(previousCompletedServices);
  const pendingRepasse = completedServices.filter(
    (service) => Number(service.valorRepasse || 0) <= 0,
  );
  const readyServices = eligibleServices(completedServices, "", links).filter(
    (service) =>
      links.some(
        (link) =>
          link.status === "ativo" &&
          link.motoristaId === service.motoristaId &&
          link.favorecidoId === service.favorecidoId,
      ),
  );
  const openLots = lots.filter(
    (lot) =>
      lot.lotStatus === LOT_STATUS.DRAFT &&
      lot.paymentStatus === PAYMENT_STATUS.OPEN,
  );
  const documentAttention = lots.filter(
    (lot) =>
      lot.paymentStatus === PAYMENT_STATUS.PAID &&
      [
        DOCUMENT_STATUS.NOT_GENERATED,
        DOCUMENT_STATUS.FAILED,
        DOCUMENT_STATUS.RESEND_REQUIRED,
      ].includes(lot.documentStatus),
  );
  const negativeMargins = completedServices.filter(
    (service) => Number(service.valorRepasse || 0) > Number(service.valorCobrado || 0),
  );
  const missingLink = completedServices.filter(
    (service) =>
      !service.favorecidoId ||
      !links.some(
        (link) =>
          link.status === "ativo" &&
          link.motoristaId === service.motoristaId &&
          link.favorecidoId === service.favorecidoId,
      ),
  );
  const openExposure = openLots.reduce(
    (total, lot) => total + Number(lot.repasse || 0),
    0,
  );
  const paidLots = lots.filter((lot) => lot.paymentStatus === PAYMENT_STATUS.PAID);
  const totalMargin = totals.marginPercent.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const marginChange = percentChange(totals.margin, previousTotals.margin);
  const profitTrend = dashboardBuckets(completedServices, range);
  const highestProfit = Math.max(...profitTrend.map((item) => item.margin), 0);
  const driverRanking = dashboardRanking(
    completedServices,
    "motoristaId",
    (service) => service.motorista || "Motorista não identificado",
  );
  const favorecidoRanking = dashboardRanking(
    completedServices,
    "favorecidoId",
    (service) =>
      favorecidos.find((favorecido) => favorecido.id === service.favorecidoId)
        ?.nome || "Sem terceiro favorecido",
  );
  const serviceTypeRanking = dashboardRanking(
    completedServices,
    "tipoVeiculo",
    (service) => service.tipoServico || service.tipoVeiculo || "Sem classificação",
  );
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const periodLabel = `${dateFormatter.format(new Date(`${range.from}T12:00:00`))} – ${dateFormatter.format(new Date(`${range.to}T12:00:00`))}`;

  return (
    <section className="page-section overview-page">
      <div className="page-title">
        <div>
          <span>Financeiro operacional</span>
          <h1>Dashboard financeiro</h1>
          <p>Resultado, exposição e pendências de fornecedores no mesmo recorte.</p>
        </div>
        <div className="dashboard-title-actions" role="group" aria-label="Ações do dashboard">
          <button className="secondary-button" onClick={onNewFavorecido}>
            <UsersRound size={16} /> Terceiro
          </button>
          <button className="primary-button" onClick={onNewLot}>
            <Plus size={16} /> Novo lote
          </button>
        </div>
      </div>

      <section className="dashboard-filters surface" aria-label="Filtros do dashboard">
        <label className="field"><span>De</span><input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
        <label className="field"><span>Até</span><input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
        <label className="field"><span>Motorista</span>
          <SearchableMultiSelect
            value={driverIds}
            onChange={setDriverIds}
            aria-label="Filtrar por motorista"
            options={drivers.map((driver) => ({ value: driver.id, label: driver.nome }))}
            placeholder="Todos os motoristas"
          />
        </label>
        <label className="field"><span>Terceiro favorecido</span>
          <SearchableMultiSelect
            value={favorecidoIds}
            onChange={setFavorecidoIds}
            aria-label="Filtrar por terceiro favorecido"
            options={favorecidos.map((favorecido) => ({
              value: favorecido.id,
              label: favorecido.nome,
            }))}
            placeholder="Todos os favorecidos"
          />
        </label>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo financeiro do período">
        <article className="dashboard-profit-card">
          <span>Lucro financeiro</span>
          <strong>{money(totals.margin)}</strong>
          <div><b>{totalMargin}%</b><small>{marginChange === null ? "sem base anterior" : `${marginChange >= 0 ? "+" : ""}${marginChange.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. período anterior`}</small></div>
        </article>
        <OverviewMetric icon={<Banknote size={19} />} label="Total CP" value={money(totals.revenue)} detail={`${totals.count} serviços concluídos`} />
        <OverviewMetric icon={<CircleDollarSign size={19} />} label="Repasse previsto" value={money(totals.repasse)} detail={`${totalMargin}% de margem`} />
        <OverviewMetric icon={<ClipboardList size={19} />} label="Em aberto" value={money(openExposure)} detail={`${openLots.length} lote(s) aguardando pagamento`} />
      </section>

      <div className="dashboard-grid dashboard-main-grid">
        <section className="surface dashboard-flow-panel">
          <div className="surface-head">
            <div><span>Resultado no tempo</span><h2>Lucro por intervalo</h2></div>
            <small className="dashboard-period">{periodLabel}</small>
          </div>
          <div className="dashboard-chart" aria-label="Gráfico de lucro do período">
            {profitTrend.map((item) => (
              <div className="dashboard-chart-column" key={item.label}>
                <span>{money(item.margin)}</span>
                <i style={{ "--bar-size": `${highestProfit ? Math.max(10, (item.margin / highestProfit) * 100) : 10}%` }} />
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-flow-foot"><span>Receita <b>{money(totals.revenue)}</b></span><span>Repasse <b>{money(totals.repasse)}</b></span><span>Margem <b>{totalMargin}%</b></span></div>
        </section>

        <section className="surface dashboard-health-panel">
          <div className="surface-head"><div><span>Controle da carteira</span><h2>O que exige ação</h2></div></div>
          <div className="overview-queue">
            <OverviewQueueRow tone={pendingRepasse.length ? "warning" : "success"} title="Repasses pendentes" description={pendingRepasse.length ? `${pendingRepasse.length} serviço(s) sem valor informado.` : "Todos os serviços possuem repasse."} action="Lançar" onClick={() => onNavigate("payments")} />
            <OverviewQueueRow tone={negativeMargins.length ? "warning" : "success"} title="Margem negativa" description={negativeMargins.length ? `${negativeMargins.length} serviço(s) com repasse acima do Total CP.` : "Nenhum serviço com margem negativa."} action="Revisar" onClick={() => onNavigate("payments")} />
            <OverviewQueueRow tone={missingLink.length ? "warning" : "success"} title="Vínculos pendentes" description={missingLink.length ? `${missingLink.length} serviço(s) sem vínculo ativo.` : "Vínculos operacionais em dia."} action="Ver" onClick={() => onNavigate("favorecidos")} />
            <OverviewQueueRow tone={documentAttention.length ? "warning" : "success"} title="Documentos" description={documentAttention.length ? `${documentAttention.length} lote(s) exigem envio ou reenvio.` : "Documentação de pagamento em dia."} action="Lotes" onClick={() => onNavigate("lots")} />
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-bottom-grid">
        <DashboardRanking title="Resultado por motorista" subtitle="Quem mais contribuiu para o lucro" rows={driverRanking} total={totals.margin} />
        <DashboardRanking title="Resultado por favorecido" subtitle="Concentração financeira da carteira" rows={favorecidoRanking} total={totals.margin} />
        <DashboardRanking title="Resultado por tipo de serviço" subtitle="Classificação operacional disponível" rows={serviceTypeRanking} total={totals.margin} />
        <section className="surface dashboard-lots-panel">
          <div className="surface-head"><div><span>Execução</span><h2>Lotes e pagamentos</h2></div><button className="text-button" onClick={() => onNavigate("lots")}>Ver todos <ChevronRight size={14} /></button></div>
          <div className="dashboard-lot-summary"><span><b>{openLots.length}</b> em aberto</span><span><b>{paidLots.length}</b> pagos</span><span><b>{readyServices.length}</b> prontos</span></div>
          <button className="dashboard-lot-action" onClick={onNewLot}><Plus size={16} /><span><strong>Montar lote</strong><small>Reserve serviços elegíveis para pagamento.</small></span><ChevronRight size={16} /></button>
        </section>
      </div>
    </section>
  );
}

function OverviewMetric({ icon, label, value, detail }) {
  return (
    <article className="dashboard-metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function DashboardRanking({ title, subtitle, rows, total }) {
  return (
    <section className="surface dashboard-ranking-panel">
      <div className="surface-head"><div><span>{subtitle}</span><h2>{title}</h2></div></div>
      <div className="dashboard-ranking-list">
        {rows.length ? rows.map((row, index) => (
          <div className="dashboard-ranking-row" key={row.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{row.name}</strong><small>{row.count} serviço(s)</small></div>
            <div><b>{money(row.margin)}</b><small>{total ? `${((row.margin / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%"}</small></div>
          </div>
        )) : <p className="dashboard-empty">Sem serviços concluídos no filtro atual.</p>}
      </div>
    </section>
  );
}

function OverviewQueueRow({ tone, title, description, action, onClick }) {
  return (
    <article className={`overview-queue-row is-${tone}`}>
      <span className="overview-queue-dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button className="text-button" onClick={onClick}>
        {action}
        <ChevronRight size={14} />
      </button>
    </article>
  );
}
function PaymentsView({
  services,
  drivers,
  favorecidos,
  allFavorecidos,
  links,
  range,
  setRange,
  search,
  setSearch,
  driverIds,
  setDriverIds,
  favorecidoIds,
  setFavorecidoIds,
  reservationStatusOptions,
  busy,
  autosaveErrors,
  onSaveRepasse,
  onLink,
  onGenerateLot,
}) {
  const [statusFilter, setStatusFilter] = useState([]);
  const statusDefaultApplied = useRef(false);
  useEffect(() => {
    if (statusDefaultApplied.current || !reservationStatusOptions.length) return;
    statusDefaultApplied.current = true;
    setStatusFilter(
      reservationStatusOptions
        .filter((option) =>
          REPASSE_DEFAULT_STATUS_LABELS.includes(
            normalizeFilterLabel(option.label),
          ),
        )
        .map((option) => option.value),
    );
  }, [reservationStatusOptions]);
  const filteredServices = useMemo(
    () =>
      services.filter((row) =>
        !statusFilter.length || statusFilter.includes(row.reservationStatus),
      ),
    [services, statusFilter],
  );
  return (
    <section className="page-section">
      <div className="page-title">
        <div>
          <span>Financeiro / operação</span>
          <h1>Lançar repasses</h1>
          <p>Confira o serviço e registre somente o valor a repassar.</p>
        </div>
      </div>
      <section className="surface filter-surface">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="Buscar serviço, motorista ou trajeto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="finance-filter-grid">
          <label className="field">
            <span>De</span>
            <input
              type="date"
              value={range.from}
              onChange={(event) =>
                setRange((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Até</span>
            <input
              type="date"
              value={range.to}
              onChange={(event) =>
                setRange((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Motorista</span>
            <SearchableMultiSelect
              value={driverIds}
              onChange={setDriverIds}
              aria-label="Filtrar lançamentos por motorista"
              options={drivers.map((row) => ({ value: row.id, label: row.nome }))}
              placeholder="Todos os motoristas"
            />
          </label>
          <label className="field">
            <span>Favorecido</span>
            <SearchableMultiSelect
              value={favorecidoIds}
              onChange={setFavorecidoIds}
              aria-label="Filtrar lançamentos por favorecido"
              options={favorecidos.map((row) => ({ value: row.id, label: row.nome }))}
              placeholder="Todos os favorecidos"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <SearchableMultiSelect
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label="Filtrar lançamentos por status"
              options={reservationStatusOptions}
              placeholder="Todos os status"
            />
          </label>
        </div>
      </section>
      <RepasseGrid
        services={filteredServices}
        favorecidos={allFavorecidos}
        busy={busy}
        autosaveErrors={autosaveErrors}
        onSave={onSaveRepasse}
        onLink={onLink}
        links={links}
        onGenerateLot={onGenerateLot}
      />
    </section>
  );
}
function RepasseGrid({
  services,
  favorecidos,
  busy,
  autosaveErrors,
  onSave,
  onLink,
  links,
  onGenerateLot,
}) {
  const [columns, setColumns] = useState(loadRepasseColumns);
  const [density, setDensity] = useState(loadRepasseDensity);
  const [views, setViews] = useState(loadRepasseViews);
  const [activeViewId, setActiveViewId] = useState(loadActiveRepasseView);
  const [showPicker, setShowPicker] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewMessage, setViewMessage] = useState("");
  const [draggedColumn, setDraggedColumn] = useState("");
  const [dropTarget, setDropTarget] = useState(null);
  const [resize, setResize] = useState(null);
  const [sort, setSort] = useState({ id: "dataServico", direction: "desc" });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const orderedColumns = useMemo(() => orderRepasseColumns(columns), [columns]);
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => column.visible),
    [orderedColumns],
  );
  const pinnedColumns = useMemo(
    () => visibleColumns.filter((column) => column.locked),
    [visibleColumns],
  );
  const lastPinnedColumnId = pinnedColumns[pinnedColumns.length - 1]?.id;
  const template = useMemo(
    () => visibleColumns.map((column) => `${column.width}px`).join(" "),
    [visibleColumns],
  );
  const gridTemplate = useMemo(() => `44px ${template}`, [template]);
  const gridScrollRef = useRef(null);
  const columnPickerRef = useRef(null);
  const columnRowRefs = useRef(new Map());
  const previousColumnPositionsRef = useRef(new Map());
  const savedViewRef = useRef(null);
  const pendingCount = useMemo(
    () => services.filter((service) => service.valorRepasse <= 0).length,
    [services],
  );
  const pickerColumns = useMemo(() => {
    const query = columnSearch.toLowerCase();
    return orderedColumns.filter((column) => column.label.toLowerCase().includes(query));
  }, [columnSearch, orderedColumns]);
  const activeView = views.find((view) => view.id === activeViewId);
  const currentView = () => ({
    columns: columns.map(({ id, width, visible, locked }) => ({
      id,
      width,
      visible,
      locked,
    })),
    density,
    sort,
  });
  const viewHasChanges =
    activeView &&
    JSON.stringify(currentView()) !==
      JSON.stringify({
        columns: activeView.columns,
        density: activeView.density,
        sort: activeView.sort,
      });
  const sortedServices = useMemo(() => {
    const isDate = ["dataServico", "dataFinalizacao"].includes(sort.id);
    const isCurrency = ["valorRepasse", "valorCobrado"].includes(sort.id);
    return [...services].sort((left, right) => {
      const result = isDate
        ? new Date(left[sort.id] || 0).getTime() -
          new Date(right[sort.id] || 0).getTime()
        : isCurrency
          ? Number(left[sort.id] || 0) - Number(right[sort.id] || 0)
          : String(left[sort.id] || "").localeCompare(
              String(right[sort.id] || ""),
              "pt-BR",
            );
      return sort.direction === "asc" ? result : -result;
    });
  }, [services, sort]);
  const activeFavorecidoIds = useMemo(
    () =>
      new Set(
        favorecidos
          .filter((favorecido) => favorecido.status === "ativo")
          .map((favorecido) => favorecido.id),
      ),
    [favorecidos],
  );
  const eligibleLotServices = useMemo(
    () =>
      services.filter(
        (service) =>
          service.favorecidoId &&
          activeFavorecidoIds.has(service.favorecidoId) &&
          eligibleServices([service], service.favorecidoId, links).length,
      ),
    [services, links, activeFavorecidoIds],
  );
  const eligibleLotServiceIds = useMemo(
    () => new Set(eligibleLotServices.map((service) => service.id)),
    [eligibleLotServices],
  );
  const selectedServices = useMemo(
    () => eligibleLotServices.filter((service) => selectedIds.has(service.id)),
    [eligibleLotServices, selectedIds],
  );
  const selectedFavorecidoId = selectedServices[0]?.favorecidoId || "";
  useEffect(() => {
    const eligibleIds = new Set(eligibleLotServices.map((service) => service.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => eligibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [eligibleLotServices]);
  const pinnedStyles = useMemo(() => {
    let left = 44;
    const styles = new Map();
    visibleColumns.forEach((column) => {
      if (!column.locked) return;
      styles.set(column.id, { left: `${left}px` });
      left += column.width;
    });
    return styles;
  }, [visibleColumns]);
  const pinnedStyle = (column) =>
    column.locked ? pinnedStyles.get(column.id) : undefined;
  useEffect(() => {
    if (!showPicker && !showViews) return undefined;
    const closeMenus = (event) => {
      if (!columnPickerRef.current?.contains(event.target)) setShowPicker(false);
      if (!savedViewRef.current?.contains(event.target)) setShowViews(false);
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, [showPicker, showViews]);

  useLayoutEffect(() => {
    const previousPositions = previousColumnPositionsRef.current;
    if (!previousPositions.size) return;
    previousColumnPositionsRef.current = new Map();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    columnRowRefs.current.forEach((element, id) => {
      const previousTop = previousPositions.get(id);
      const delta = previousTop - element.getBoundingClientRect().top;
      if (previousTop === undefined || Math.abs(delta) < 1) return;
      element.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 190, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    });
  }, [columns]);

  useEffect(() => {
    localStorage.setItem(REPASSE_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);
  useEffect(() => {
    localStorage.setItem(REPASSE_DENSITY_STORAGE_KEY, density);
  }, [density]);
  useEffect(() => {
    localStorage.setItem(REPASSE_VIEWS_STORAGE_KEY, JSON.stringify(views));
  }, [views]);
  useEffect(() => {
    localStorage.setItem(REPASSE_ACTIVE_VIEW_STORAGE_KEY, activeViewId);
  }, [activeViewId]);
  useEffect(() => {
    if (!resize) return undefined;
    const move = (event) => {
      const width = Math.max(110, resize.width + event.clientX - resize.startX);
      setColumns((current) =>
        current.map((column) =>
          column.id === resize.id ? { ...column, width } : column,
        ),
      );
    };
    const stop = () => setResize(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [resize]);

  const reorderColumns = (sourceId, targetId, placement = "before") => {
    if (!sourceId || sourceId === targetId) return;
    setColumns((current) => {
      const next = orderRepasseColumns(current);
      const source = next.findIndex((column) => column.id === sourceId);
      const target = next.findIndex((column) => column.id === targetId);
      if (source < 0 || target < 0) return current;
      previousColumnPositionsRef.current = new Map(
        [...columnRowRefs.current].map(([id, element]) => [
          id,
          element.getBoundingClientRect().top,
        ]),
      );
      const [column] = next.splice(source, 1);
      const targetIndex = next.findIndex((item) => item.id === targetId);
      const targetColumn = next[targetIndex];
      next.splice(targetIndex + (placement === "after" ? 1 : 0), 0, {
        ...column,
        locked: targetColumn.locked,
      });
      return next;
    });
  };
  const moveColumn = (targetId, placement) => {
    reorderColumns(draggedColumn, targetId, placement);
    setDraggedColumn("");
    setDropTarget(null);
  };
  const moveColumnToEnd = () => {
    const source = orderedColumns.find((column) => column.id === draggedColumn);
    const target = [...orderedColumns]
      .reverse()
      .find((column) => column.locked === source?.locked);
    if (target) reorderColumns(draggedColumn, target.id, "after");
    setDraggedColumn("");
    setDropTarget(null);
  };
  const toggleColumn = (id) =>
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, visible: !column.visible } : column,
      ),
    );
  const toggleColumnPin = (id) =>
    setColumns((current) => {
      previousColumnPositionsRef.current = new Map(
        [...columnRowRefs.current].map(([columnId, element]) => [
          columnId,
          element.getBoundingClientRect().top,
        ]),
      );
      return orderRepasseColumns(
        current.map((column) =>
          column.id === id ? { ...column, locked: !column.locked } : column,
        ),
      );
    });
  const resetColumns = () =>
    setColumns(REPASSE_COLUMNS.map((column) => ({ ...column, visible: true })));
  const adjustColumnWidth = (id, delta) =>
    setColumns((current) =>
      current.map((column) =>
        column.id === id
          ? { ...column, width: Math.max(110, column.width + delta) }
          : column,
      ),
    );
  const cycleSort = (id) =>
    setSort((current) =>
      current.id === id
        ? { id, direction: current.direction === "asc" ? "desc" : "asc" }
        : { id, direction: "asc" },
    );
  const moveColumnWithKeyboard = (id, direction) => {
    const index = orderedColumns.findIndex((column) => column.id === id);
    const source = orderedColumns[index];
    const target = orderedColumns[index + direction];
    if (!source || !target) return;
    const placement =
      source.locked === target.locked || direction > 0 ? "before" : "after";
    reorderColumns(id, target.id, placement);
  };
  const applyView = (view) => {
    setColumns(viewColumns(view.columns));
    setDensity(view.density === "compact" ? "compact" : "comfortable");
    setSort(view.sort || { id: "dataServico", direction: "desc" });
    setActiveViewId(view.id);
    setViewMessage(`View “${view.name}” aplicada.`);
    setShowViews(false);
  };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) {
      setViewMessage("Informe um nome para salvar a view.");
      return;
    }
    if (views.some((view) => view.name.toLowerCase() === name.toLowerCase())) {
      setViewMessage("Já existe uma view com este nome.");
      return;
    }
    const view = {
      id: `view-${Date.now()}`,
      name,
      ...currentView(),
    };
    setViews((current) => [...current, view]);
    setActiveViewId(view.id);
    setViewName("");
    setViewMessage(`View “${name}” salva.`);
  };
  const updateView = () => {
    if (!activeView) return;
    setViews((current) =>
      current.map((view) =>
        view.id === activeView.id ? { ...view, ...currentView() } : view,
      ),
    );
    setViewMessage(`View “${activeView.name}” atualizada.`);
  };
  const deleteView = () => {
    if (!activeView) return;
    setViews((current) => current.filter((view) => view.id !== activeView.id));
    setActiveViewId("");
    setViewMessage(`View “${activeView.name}” excluída.`);
  };
  const cell = (service, column) => {
    if (column.id === "identificador")
      return (
        <ServiceIdentifierLink
          identifier={service.identificador}
          reservationId={service.reservationId}
        />
      );
    if (column.id === "valorRepasse")
      return (
        <RepasseInput
          service={service}
          saving={busy(`repasse-${service.id}`) || busy(`link-${service.id}`)}
          onSave={onSave}
        />
      );
    if (column.id === "favorecido")
      return (
        <FavorecidoCell
          service={service}
          favorecidos={favorecidos}
          saving={busy(`link-${service.id}`)}
          error={autosaveErrors[`link-${service.id}`]}
          onLink={onLink}
        />
      );
    if (column.id === "valorCobrado")
      return (
        <strong className="currency-cell">{money(service.valorCobrado)}</strong>
      );
    if (column.id === "dataServico" || column.id === "dataFinalizacao")
      return (
        <span>{formatServiceDate(service[column.id], "Não informado")}</span>
      );
    return (
      <span title={service[column.id] || "Não informado"}>
        {service[column.id] || "Não informado"}
      </span>
    );
  };

  const toggleServiceSelection = (serviceId) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });

  return (
    <section
      className={`surface repasse-grid-shell ${density === "compact" ? "is-compact" : ""}`}
    >
      <div className="repasse-grid-toolbar">
        <div className="repasse-grid-summary">
          <strong>{services.length}</strong>
          <span>serviços concluídos</span>
          {pendingCount > 0 && <b>{pendingCount} pendente(s)</b>}
          <small>Configuração salva automaticamente.</small>
        </div>
        <div className="repasse-grid-actions">
          <button
            className="primary-button repasse-generate-lot"
            disabled={!selectedServices.length}
            onClick={() => onGenerateLot(selectedServices)}
          >
            <ClipboardList size={16} />
            Gerar lote{selectedServices.length ? ` (${selectedServices.length})` : ""}
          </button>
          <div className="saved-view-wrap" ref={savedViewRef}>
            <button
              className={`secondary-button ${activeView ? "is-active" : ""}`}
              onClick={() => {
                setShowViews((value) => !value);
                setShowPicker(false);
              }}
              aria-expanded={showViews}
            >
              <TableProperties size={16} />
              {activeView ? activeView.name : "Views"}
            </button>
            {showViews && (
              <div className="saved-view-menu" role="dialog" aria-label="Views salvas">
                <div className="saved-view-head">
                  <div>
                    <strong>Views da tabela</strong>
                    <span>
                      {activeView
                        ? viewHasChanges
                          ? "Alterações não salvas"
                          : "View ativa"
                        : "Layout atual não salvo"}
                    </span>
                  </div>
                </div>
                <div className="saved-view-list">
                  {views.map((view) => (
                    <button
                      className={view.id === activeViewId ? "is-selected" : ""}
                      key={view.id}
                      onClick={() => applyView(view)}
                    >
                      <span>{view.name}</span>
                      {view.id === activeViewId && <CheckCircle2 size={14} />}
                    </button>
                  ))}
                  {!views.length && (
                    <span className="saved-view-empty">Nenhuma view salva.</span>
                  )}
                </div>
                {activeView && (
                  <div className="saved-view-active">
                    <div>
                      <span>View ativa</span>
                      <strong>{activeView.name}</strong>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={updateView}
                      disabled={!viewHasChanges}
                    >
                      <Save size={15} />
                      Salvar alterações
                    </button>
                  </div>
                )}
                <div className="saved-view-create">
                  <span>Salvar layout como nova view</span>
                  <div>
                  <input
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveView();
                    }}
                    placeholder="Nome da nova view"
                    aria-label="Nome da nova view"
                  />
                  <button className="primary-button" onClick={saveView}>
                    <Save size={15} />
                    Criar
                  </button>
                  </div>
                </div>
                <div className="saved-view-foot">
                  {viewMessage && <span>{viewMessage}</span>}
                  {activeView && (
                    <button className="text-button" onClick={deleteView}>
                      Excluir view
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            className={`secondary-button density-button ${density === "compact" ? "is-active" : ""}`}
            onClick={() =>
              setDensity((current) =>
                current === "compact" ? "comfortable" : "compact",
              )
            }
            aria-pressed={density === "compact"}
            title="Alternar densidade das linhas"
          >
            <Rows3 size={16} />
            {density === "compact" ? "Compacta" : "Compactar"}
          </button>
          <div className="column-picker-wrap" ref={columnPickerRef}>
            <button
              className="secondary-button"
              onClick={() => {
                setShowPicker((value) => !value);
                setShowViews(false);
              }}
              aria-expanded={showPicker}
            >
              <Columns3 size={16} />
              Colunas
            </button>
            {showPicker && (
              <div
                className="column-picker"
                role="dialog"
                aria-label="Escolher colunas"
              >
                <div className="column-picker-head">
                  <strong>Exibir colunas</strong>
                  <button className="text-button" onClick={resetColumns}>
                    Restaurar
                  </button>
                </div>
                <input
                  className="column-search"
                  value={columnSearch}
                  onChange={(event) => setColumnSearch(event.target.value)}
                  placeholder="Localizar coluna"
                  aria-label="Localizar coluna"
                />
                {pickerColumns.map((column) => (
                  <div
                    className={`column-picker-row ${draggedColumn === column.id ? "is-dragging" : ""} ${dropTarget?.id === column.id ? `is-drop-${dropTarget.placement}` : ""}`}
                    key={column.id}
                    ref={(element) => {
                      if (element) columnRowRefs.current.set(column.id, element);
                      else columnRowRefs.current.delete(column.id);
                    }}
                    onDragOver={(event) => {
                      if (!draggedColumn || draggedColumn === column.id) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      const rect = event.currentTarget.getBoundingClientRect();
                      const nextTarget = {
                        id: column.id,
                        placement:
                          event.clientY < rect.top + rect.height / 2
                            ? "before"
                            : "after",
                      };
                      setDropTarget((current) =>
                        current?.id === nextTarget.id &&
                        current.placement === nextTarget.placement
                          ? current
                          : nextTarget,
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveColumn(
                        column.id,
                        dropTarget?.id === column.id
                          ? dropTarget.placement
                          : "before",
                      );
                    }}
                  >
                    <button
                      type="button"
                      className="column-drag-handle"
                      draggable
                      aria-label={`Reordenar ${column.label}`}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", column.id);
                        setDropTarget(null);
                        setDraggedColumn(column.id);
                      }}
                      onDragEnd={() => {
                        setDraggedColumn("");
                        setDropTarget(null);
                      }}
                    >
                      <GripVertical size={15} aria-hidden="true" />
                    </button>
                    <label>
                      <input
                        type="checkbox"
                        checked={column.visible}
                        onChange={() => toggleColumn(column.id)}
                      />
                      <span>{column.label}</span>
                    </label>
                    <button
                      type="button"
                      className={`column-pin ${column.locked ? "is-active" : ""}`}
                      aria-label={`${column.locked ? "Desafixar" : "Fixar"} ${column.label}`}
                      aria-pressed={column.locked}
                      title={column.locked ? "Desafixar coluna" : "Fixar à esquerda"}
                      onClick={() => toggleColumnPin(column.id)}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                ))}
                <div
                  className="column-picker-drop-end"
                  aria-hidden="true"
                  onDragOver={(event) => {
                    const source = orderedColumns.find(
                      (column) => column.id === draggedColumn,
                    );
                    const target = [...orderedColumns]
                      .reverse()
                      .find((column) => column.locked === source?.locked);
                    if (!source || !target || source.id === target.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget({ id: target.id, placement: "after" });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveColumnToEnd();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="repasse-grid-viewport">
        <div className="repasse-grid-scroll" ref={gridScrollRef}>
          <div
          className="repasse-grid"
          style={{
            gridTemplateColumns: gridTemplate,
            minWidth: gridTemplate ? undefined : 0,
          }}
        >
          <div
            className="repasse-grid-head"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="repasse-grid-select-cell is-header" />
            {visibleColumns.map((column) => (
              <div
                className={`repasse-grid-header ${column.locked ? "is-pinned" : ""} ${column.id === lastPinnedColumnId ? "is-pinned-edge" : ""}`}
                key={column.id}
                style={pinnedStyle(column)}
                draggable
                role="columnheader"
                tabIndex={0}
                aria-sort={
                  sort.id === column.id
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                onDragStart={() => setDraggedColumn(column.id)}
                onDragEnd={() => setDraggedColumn("")}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveColumn(column.id)}
                onClick={() => cycleSort(column.id)}
                onKeyDown={(event) => {
                  if (
                    event.altKey &&
                    ["ArrowLeft", "ArrowRight"].includes(event.key)
                  ) {
                    event.preventDefault();
                    adjustColumnWidth(
                      column.id,
                      event.key === "ArrowRight" ? 16 : -16,
                    );
                  } else if (
                    event.shiftKey &&
                    ["ArrowLeft", "ArrowRight"].includes(event.key)
                  ) {
                    event.preventDefault();
                    moveColumnWithKeyboard(
                      column.id,
                      event.key === "ArrowRight" ? 1 : -1,
                    );
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    cycleSort(column.id);
                  }
                }}
              >
                <GripVertical size={14} aria-hidden="true" />
                <span>{column.label}</span>
                {sort.id === column.id ? (
                  sort.direction === "asc" ? (
                    <ArrowUp size={13} aria-label="Crescente" />
                  ) : (
                    <ArrowDown size={13} aria-label="Decrescente" />
                  )
                ) : (
                  <ArrowUpDown size={13} aria-hidden="true" />
                )}
                <button
                  className="column-resizer"
                  aria-label={`Redimensionar ${column.label}`}
                  title="Arraste para redimensionar; clique duas vezes para restaurar"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setResize({
                      id: column.id,
                      startX: event.clientX,
                      width: column.width,
                    });
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    const defaultColumn = REPASSE_COLUMNS.find(
                      (item) => item.id === column.id,
                    );
                    setColumns((current) =>
                      current.map((item) =>
                        item.id === column.id
                          ? { ...item, width: defaultColumn.width }
                          : item,
                      ),
                    );
                  }}
                />
              </div>
            ))}
          </div>
          {sortedServices.map((service) => {
            const isEligibleForLot = eligibleLotServiceIds.has(service.id);
            const isOtherFavorecido =
              selectedFavorecidoId &&
              service.favorecidoId !== selectedFavorecidoId;
            const isSelected = selectedIds.has(service.id);
            const selectionDisabled = !isEligibleForLot || isOtherFavorecido;
            const selectionLabel = !isEligibleForLot
              ? "Serviço ainda não está elegível para lote"
              : isOtherFavorecido
                ? "Um lote só pode conter serviços do mesmo favorecido"
                : `Selecionar ${service.identificador} para gerar lote`;
            return (
            <div
              className={`repasse-grid-row ${service.valorRepasse <= 0 ? "is-pending" : ""} ${isSelected ? "is-selected" : ""}`}
              key={service.id}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="repasse-grid-select-cell">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={selectionDisabled}
                  onChange={() => toggleServiceSelection(service.id)}
                  aria-label={selectionLabel}
                  title={selectionLabel}
                />
              </div>
              {visibleColumns.map((column) => (
                <div
                  className={`repasse-grid-cell cell-${column.id} ${column.locked ? "is-pinned" : ""} ${column.id === lastPinnedColumnId ? "is-pinned-edge" : ""}`}
                  key={column.id}
                  style={pinnedStyle(column)}
                >
                  {cell(service, column)}
                </div>
              ))}
            </div>
            );
          })}
          {!services.length && (
            <div className="empty-state">
              <FileText size={28} />
              <strong>Nenhum serviço no período</strong>
              <span>Amplie o intervalo ou ajuste os filtros.</span>
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
function RepasseInput({ service, saving, onSave }) {
  const [draft, setDraft] = useState(moneyInput(service.valorRepasse));
  const [feedback, setFeedback] = useState(null);
  useEffect(
    () => setDraft(moneyInput(service.valorRepasse)),
    [service.valorRepasse],
  );
  useEffect(() => {
    if (!feedback || feedback.type !== "saved") return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 1850);
    return () => window.clearTimeout(timeout);
  }, [feedback]);
  const value = parseMoney(draft);
  const changed = value !== service.valorRepasse;
  const currentMargin = marginPercent({ ...service, valorRepasse: value });
  const marginTone =
    currentMargin < 0
      ? "is-negative"
      : currentMargin === 0
        ? "is-neutral"
        : "is-positive";
  const save = async () => {
    if (!changed || saving) return;
    setFeedback({ type: "saving" });
    try {
      await onSave(service, draft);
      setFeedback({ type: "saved" });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message,
        canRetry: err.status !== 412,
      });
    }
  };
  const status = saving ? { type: "saving" } : feedback;
  const pending = !status && !changed && value <= 0;
  return (
    <div className="grid-money-input">
      <input
        className={pending ? "is-pending" : undefined}
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setFeedback(null);
        }}
        onBlur={save}
        aria-label={`Repasse de ${service.identificador}`}
      />
      <div className="repasse-meta">
        {pending && <span className="repasse-pending" role="status" aria-label="Repasse pendente" title="Repasse pendente" />}
        <small className={`repasse-margin ${marginTone}`}>
          {currentMargin.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          %
        </small>
      </div>
      {status?.type === "saving" && (
        <span
          className="repasse-save-icon is-saving"
          role="status"
          aria-label="Salvando repasse"
        >
          <RefreshCw size={12} className="spin" aria-hidden="true" />
        </span>
      )}
      {status?.type === "saved" && !changed && (
        <span className="repasse-save-icon is-saved" title="Repasse salvo">
          <CheckCircle2 size={21} strokeWidth={2.6} aria-label="Repasse salvo" />
        </span>
      )}
      {status?.type === "error" && (
        <AutoSaveErrorIcon
          message={status.message}
          label="Repasse não salvo"
          onRetry={save}
          canRetry={status.canRetry}
        />
      )}
    </div>
  );
}
function AutoSaveErrorIcon({ message, label, onRetry, canRetry = true }) {
  if (!canRetry)
    return (
      <span className="repasse-save-icon is-error" title={message} aria-label={label}>
        <AlertTriangle size={13} aria-hidden="true" />
      </span>
    );
  return (
    <button
      type="button"
      className="repasse-save-icon is-error"
      title={`${message} Clique para tentar novamente.`}
      aria-label={`${label}. Tentar novamente`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRetry}
    >
      <AlertTriangle size={13} aria-hidden="true" />
    </button>
  );
}
function FavorecidoCell({ service, favorecidos, saving, error, onLink }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [service.favorecidoId]);
  const errorIcon = error ? (
    <AutoSaveErrorIcon
      message={error.message}
      label="Favorecido não salvo"
      onRetry={() => onLink(service, error.favorecidoId)}
    />
  ) : null;
  if (service.favorecidoId && !editing) {
    const favorecido = favorecidos.find(
      (row) => row.id === service.favorecidoId,
    );
    return (
      <div className="favorecido-linked">
        <Badge tone="green">Vinculado</Badge>
        <div className="favorecido-linked-name">
          <span title={favorecido?.nome || "Favorecido"}>
            {favorecido?.nome || "Favorecido"}
          </span>
          <button
            type="button"
            className="favorecido-edit"
            disabled={saving}
            onClick={() => setEditing(true)}
            aria-label={`Trocar favorecido de ${service.identificador}`}
            title="Trocar favorecido"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        </div>
        {errorIcon}
      </div>
    );
  }
  return (
    <div className="favorecido-cell">
      <SearchableSelect
        value={service.favorecidoId || ""}
        disabled={saving}
        clearable={false}
        placeholder="Vincular favorecido"
        aria-label={`Trocar favorecido de ${service.identificador}`}
        className="repasse-favorecido-select"
        options={[
          { value: "", label: "Vincular favorecido" },
          ...favorecidos.map((row) => ({
            value: row.id,
            label: row.nome,
            search: `${row.documento || ""} ${row.email || ""}`,
          })),
        ]}
        onChange={async (value) => {
          if (!value || value === service.favorecidoId) {
            setEditing(false);
            return;
          }
          await onLink(service, value);
          setEditing(false);
        }}
      />
      {errorIcon}
    </div>
  );
}

function LotsView({ lots, onNew, onOpen }) {
  return (
    <section className="page-section">
      <div className="page-title">
        <div>
          <span>Rastreabilidade</span>
          <h1>Lotes de pagamento</h1>
          <p>Rascunhos, pagamentos e documentos em uma trilha auditável.</p>
        </div>
        <button className="primary-button" onClick={onNew}>
          <Plus size={16} />
          Novo lote
        </button>
      </div>
      <section className="operations-list operations-list-lots" aria-label="Lotes de pagamento">
        <div className="operations-list-head">
          <div>
            <span>Visao operacional</span>
            <strong>{lots.length} lote(s) no historico</strong>
          </div>
          <small>Abra um lote para consultar pagamentos e documentos.</small>
        </div>
        {lots.map((lot) => (
          <button className="payment-lot-card" key={lot.id} onClick={() => onOpen(lot)}>
            <span className="payment-lot-card-icon" aria-hidden="true"><ClipboardList size={18} /></span>
            <div className="payment-lot-card-copy">
              <strong>{lot.identifier}</strong>
              <span>{lot.favorecido?.nome || JSON.parse(lot.favorecidoSnapshot || "{}").nome || "Terceiro Favorecido"}</span>
            </div>
            <div className="payment-lot-card-value">
              <small>Valor reservado</small>
              <strong>{money(lot.repasse)}</strong>
            </div>
            <Badge tone={lot.paymentStatus === PAYMENT_STATUS.PAID ? "green" : "blue"}>
              {statusText(lot)}
            </Badge>
            <ChevronRight className="payment-lot-card-arrow" size={18} aria-hidden="true" />
          </button>
        ))}
        {!lots.length && (
          <div className="operations-empty">Nenhum lote criado neste ambiente.</div>
        )}
      </section>
    </section>
  );
}

function FavorecidosView({
  favorecidos,
  drivers,
  links,
  onNew,
  onEdit,
  onLinks,
  onStatus,
}) {
  return (
    <section className="page-section">
      <div className="page-title">
        <div>
          <span>Cadastros financeiros</span>
          <h1>Terceiros Favorecidos</h1>
          <p>Gerencie dados PIX, status e vínculos com motoristas.</p>
        </div>
        <button className="primary-button" onClick={onNew}>
          <Plus size={16} />
          Novo terceiro
        </button>
      </div>
      <section className="operations-list operations-list-beneficiaries" aria-label="Terceiros favorecidos">
        <div className="operations-list-head">
          <div>
            <span>Base de pagamento</span>
            <strong>{favorecidos.length} favorecido(s) cadastrado(s)</strong>
          </div>
          <small>PIX, situacao e vinculos por pessoa ou empresa.</small>
        </div>
        {favorecidos.map((row) => {
          const count = links.filter(
            (link) => link.favorecidoId === row.id && link.status === "ativo",
          ).length;
          return (
            <article className="beneficiary-card" key={row.id}>
              <div className="beneficiary-card-profile">
                <div className="beneficiary-card-avatar" aria-hidden="true">
                  {row.nome.trim().slice(0, 2).toUpperCase()}
                </div>
                <div className="beneficiary-card-copy">
                  <strong>{row.nome}</strong>
                  <span>{row.tipoPessoa} · {row.documento}</span>
                </div>
              </div>
              <div className="beneficiary-card-pix">
                <small>Chave PIX</small>
                <strong>{maskPix(row.chavePix)}</strong>
              </div>
              <div className="beneficiary-card-links">
                <UsersRound size={15} aria-hidden="true" />
                <span>{count} motorista(s)</span>
              </div>
              <Badge tone={row.status === "ativo" ? "green" : "neutral"}>
                {row.status}
              </Badge>
              <div className="beneficiary-card-actions">
                <button className="secondary-button" onClick={() => onLinks(row)}>
                  <Link2 size={15} />
                  Vínculos
                </button>
                <button className="text-button" onClick={() => onEdit(row)}>
                  Editar
                </button>
                <button className="text-button" onClick={() => onStatus(row)}>
                  {row.status === "ativo" ? "Inativar" : "Ativar"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}

function FavorecidoDrawer({ favorecido, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    nome: favorecido?.nome || "",
    tipoPessoa: favorecido?.tipoPessoa || "PF",
    documento: favorecido?.documento || "",
    tipoChavePix: favorecido?.tipoChavePix || "CPF/CNPJ",
    chavePix: favorecido?.chavePix || "",
    email: favorecido?.email || "",
    telefone: favorecido?.telefone || "",
  });
  const [errors, setErrors] = useState({});
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Drawer
      title={
        favorecido ? "Editar Terceiro Favorecido" : "Novo Terceiro Favorecido"
      }
      subtitle="Cadastro financeiro"
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const validation = validateFavorecido(form);
          setErrors(validation);
          if (!Object.keys(validation).length) onSave(form);
        }}
      >
        <label className="field">
          <span>Nome ou razão social *</span>
          <input
            value={form.nome}
            onChange={(event) => set("nome", event.target.value)}
            autoFocus
          />
          {errors.nome && <small className="field-error">{errors.nome}</small>}
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Tipo</span>
            <SearchableSelect
              value={form.tipoPessoa}
              onChange={(value) => set("tipoPessoa", value)}
              clearable={false}
              aria-label="Tipo de pessoa"
              options={[
                { value: "PF", label: "PF" },
                { value: "PJ", label: "PJ" },
              ]}
            />
          </label>
          <label className="field">
            <span>CPF ou CNPJ *</span>
            <input
              value={form.documento}
              onChange={(event) => set("documento", event.target.value)}
            />
            {errors.documento && (
              <small className="field-error">{errors.documento}</small>
            )}
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Tipo da chave PIX</span>
            <SearchableSelect
              value={form.tipoChavePix}
              onChange={(value) => set("tipoChavePix", value)}
              clearable={false}
              aria-label="Tipo da chave PIX"
              options={[
                { value: "CPF/CNPJ", label: "CPF/CNPJ" },
                { value: "E-mail", label: "E-mail" },
                { value: "Telefone", label: "Telefone" },
                { value: "Aleatória", label: "Aleatória" },
              ]}
            />
          </label>
          <label className="field">
            <span>Chave PIX *</span>
            <input
              value={form.chavePix}
              onChange={(event) => set("chavePix", event.target.value)}
            />
            {errors.chavePix && (
              <small className="field-error">{errors.chavePix}</small>
            )}
          </label>
        </div>
        <label className="field">
          <span>E-mail *</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => set("email", event.target.value)}
          />
          {errors.email && (
            <small className="field-error">{errors.email}</small>
          )}
        </label>
        <label className="field">
          <span>Telefone</span>
          <input
            value={form.telefone}
            onChange={(event) => set("telefone", event.target.value)}
          />
        </label>
        <div className="drawer-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" disabled={saving}>
            <Save size={16} />
            {saving
              ? "Salvando…"
              : favorecido
                ? "Salvar alterações"
                : "Salvar cadastro"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
function LinksDrawer({
  favorecido,
  drivers,
  links,
  saving,
  onClose,
  onSave,
  onDeactivate,
}) {
  const [driverId, setDriverId] = useState("");
  const active = links.filter(
    (row) => row.favorecidoId === favorecido.id && row.status === "ativo",
  );
  return (
    <Drawer
      title={`Vínculos · ${favorecido.nome}`}
      subtitle="Motoristas ativos"
      onClose={onClose}
    >
      <div className="form-stack">
        <label className="field">
          <span>Adicionar motorista</span>
          <SearchableSelect
            value={driverId}
            onChange={setDriverId}
            aria-label="Adicionar motorista"
            options={[
              { value: "", label: "Selecione" },
              ...drivers
                .filter(
                  (row) => !active.some((link) => link.motoristaId === row.id),
                )
                .map((row) => ({ value: row.id, label: row.nome })),
            ]}
          />
        </label>
        <button
          className="primary-button"
          disabled={!driverId || saving}
          onClick={async () => {
            await onSave(driverId);
            setDriverId("");
          }}
        >
          Vincular motorista
        </button>
        <div className="selection-list">
          {active.map((link) => (
            <div className="selection-row" key={link.id}>
              <div>
                <strong>
                  {drivers.find((row) => row.id === link.motoristaId)?.nome ||
                    link.motoristaId}
                </strong>
                <span>Vínculo ativo</span>
              </div>
              <Badge tone="green">Ativo</Badge>
              <button
                className="text-button"
                disabled={saving}
                onClick={() => onDeactivate(link.id)}
              >
                Inativar
              </button>
            </div>
          ))}
          {!active.length && (
            <div className="empty-small">Nenhum motorista vinculado.</div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
function LotDrawer({
  favorecidos,
  services,
  links,
  range,
  preselected,
  initialFavorecidoId,
  existingLot,
  saving,
  onClose,
  onSave,
}) {
  const [favorecidoId, setFavorecidoId] = useState(
    existingLot?.favorecidoId || initialFavorecidoId || favorecidos[0]?.id || "",
  );
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const available = useMemo(() => {
    const scoped = services.filter(
      (row) =>
        row.dataServico.slice(0, 10) >= from &&
        row.dataServico.slice(0, 10) <= to,
    );
    const eligible = eligibleServices(scoped, favorecidoId, links);
    const reservedHere = scoped.filter(
      (row) => row.pagamentoId === existingLot?.id,
    );
    return [
      ...eligible,
      ...reservedHere.filter(
        (row) => !eligible.some((candidate) => candidate.id === row.id),
      ),
    ];
  }, [services, favorecidoId, links, from, to, existingLot?.id]);
  const [selected, setSelected] = useState([]);
  useEffect(
    () =>
      setSelected(
        available
          .filter(
            (row) =>
              existingLot?.items?.some((item) => item.serviceId === row.id) ||
              (!existingLot &&
                (preselected.size
                  ? preselected.has(row.id)
                  : row.favorecidoId === favorecidoId)),
          )
          .map((row) => row.id),
      ),
    [favorecidoId, available.length, existingLot, preselected],
  );
  const chosen = available.filter((row) => selected.includes(row.id));
  const totals = paymentTotals(chosen);
  const favorecido = favorecidos.find((row) => row.id === favorecidoId);
  return (
    <Drawer
      title={existingLot ? "Editar rascunho" : "Montar lote"}
      subtitle="Reserva segura de serviços"
      wide
      onClose={onClose}
    >
      <div className="form-stack">
        <label className="field">
          <span>Terceiro Favorecido</span>
          <SearchableSelect
            value={favorecidoId}
            onChange={setFavorecidoId}
            clearable={false}
            aria-label="Terceiro favorecido do lote"
            options={favorecidos.map((row) => ({
              value: row.id,
              label: row.nome,
            }))}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>De</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Até</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        <div className="lot-summary">
          <div>
            <span>Serviços</span>
            <strong>{totals.count}</strong>
          </div>
          <div>
            <span>Repasse</span>
            <strong>{money(totals.repasse)}</strong>
          </div>
          <div>
            <span>Lucro</span>
            <strong>{money(totals.margin)}</strong>
          </div>
        </div>
        {totals.margin < 0 && (
          <div className="inline-alert warning-alert">
            <AlertTriangle size={16} />
            Este lote possui lucro negativo, mas pode ser criado.
          </div>
        )}
        <div className="selection-list">
          {available.map((service) => (
            <label className="selection-row" key={service.id}>
              <input
                type="checkbox"
                checked={selected.includes(service.id)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(service.id)
                      ? current.filter((id) => id !== service.id)
                      : [...current, service.id],
                  )
                }
              />
              <div>
                <ServiceIdentifierLink
                  identifier={service.identificador}
                  reservationId={service.reservationId}
                />
                <span>
                  {service.motorista} · {service.trajeto}
                </span>
              </div>
              <b>{money(service.valorRepasse)}</b>
            </label>
          ))}
          {!available.length && (
            <div className="empty-small">
              Não há serviços elegíveis neste período.
            </div>
          )}
        </div>
        <div className="drawer-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary-button"
            disabled={!favorecido || !chosen.length || saving}
            onClick={() =>
              onSave({
                favorecido,
                services: chosen,
                year: Number(from.slice(0, 4)),
              })
            }
          >
            <ClipboardList size={16} />
            {saving
              ? "Reservando…"
              : existingLot
                ? "Salvar rascunho"
                : "Criar lote"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
function LotDetailDrawer({
  lot,
  busy,
  onClose,
  onPay,
  onSend,
  onEdit,
  onCancel,
  onRevert,
}) {
  const [proofUrl, setProofUrl] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const isPaid = lot.paymentStatus === PAYMENT_STATUS.PAID;
  return (
    <Drawer
      title={lot.identifier}
      subtitle="Controle e auditoria"
      onClose={onClose}
    >
      <div className="detail-stack">
        <div className="detail-hero">
          <div>
            <Badge tone={isPaid ? "green" : "blue"}>{statusText(lot)}</Badge>
            <span>Versão {lot.version}</span>
          </div>
          <h3>
            {lot.favorecido?.nome ||
              JSON.parse(lot.favorecidoSnapshot || "{}").nome}
          </h3>
          <p>
            {money(lot.repasse)} · {lot.count} serviço(s) ·{" "}
            {lot.marginPercent?.toFixed(1) || "0.0"}%
          </p>
        </div>
        <div className="detail-card">
          <h3>Serviços congelados</h3>
          <div className="compact-list">
            {lot.items.map((item) => (
              <div key={item.id}>
                <ServiceIdentifierLink
                  identifier={item.identificador}
                  reservationId={item.reservationId}
                />
                <span>
                  {item.motorista} · {money(item.valorRepasse)}
                </span>
              </div>
          ))}
        </div>
      </div>
        <div className="detail-card">
          <h3>Ações</h3>
          <div className="detail-actions">
            {canPay(lot) && (
              <button onClick={onEdit}>
                <ClipboardList size={18} />
                <div>
                  <strong>Editar rascunho</strong>
                  <span>Altera período, favorecido e serviços reservados.</span>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {canPay(lot) && (
              <>
                <label className="proof-input field">
                  <span>Comprovante opcional</span>
                  <input
                    value={proofUrl}
                    onChange={(event) => setProofUrl(event.target.value)}
                    placeholder="URL interna do comprovante"
                  />
                  <input
                    type="file"
                    onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                  />
                  <small>{proofFile ? `${proofFile.name} · será salvo no OneDrive e substituirá a URL` : "Qualquer arquivo · máximo 5 MB"}</small>
                </label>
                <button
                  disabled={busy(`pay-${lot.id}`)}
                  onClick={() => onPay(lot, { file: proofFile, url: proofUrl })}
                >
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Registrar como pago</strong>
                    <span>Confirma pagamento integral e gera documento.</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            {isPaid && (
              <button
                disabled={busy(`document-${lot.id}`)}
                onClick={() => onSend(lot)}
              >
                <Send size={18} />
                <div>
                  <strong>
                    {lot.documentStatus === DOCUMENT_STATUS.FAILED
                      ? "Reenviar documento"
                      : "Gerar documento"}
                  </strong>
                  <span>Salva no OneDrive e envia PDF anexado.</span>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {canRevert(lot) && (
              <button onClick={onRevert}>
                <Undo2 size={18} />
                <div>
                  <strong>Desmarcar pago</strong>
                  <span>Exige motivo e preserva histórico.</span>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
            {canCancel(lot) && (
              <button onClick={onCancel}>
                <X size={18} />
                <div>
                  <strong>Cancelar lote</strong>
                  <span>Libera serviços para nova seleção.</span>
                </div>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
        {lot.documentUrl && (
          <a
            className="document-link"
            href={lot.documentUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FileDown size={16} />
            Abrir documento atual
          </a>
        )}
        <div className="detail-card">
          <h3>Linha do tempo</h3>
          <div className="timeline">
            {lot.events.map((event) => (
              <div key={event.id}>
                <span />
                <div>
                  <strong>{event.message}</strong>
                  <small>
                    {new Date(event.createdAt).toLocaleString("pt-BR")} ·{" "}
                    {event.user}
                    {event.reason ? ` · Motivo: ${event.reason}` : ""}
                  </small>
                  {event.detail && <em>{event.detail}</em>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
function ReasonDrawer({ action, saving, onClose, onSave }) {
  const [reason, setReason] = useState("");
  const label =
    action.type === "cancel" ? "cancelamento" : "reversão de pagamento";
  return (
    <Drawer
      title={`Motivo do ${label}`}
      subtitle="Auditoria obrigatória"
      onClose={onClose}
    >
      <div className="form-stack">
        <label className="field">
          <span>Motivo *</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
        </label>
        <div className="drawer-actions">
          <button className="secondary-button" onClick={onClose}>
            Voltar
          </button>
          <button
            className="primary-button"
            disabled={!reason.trim() || saving}
            onClick={() => onSave(action, reason)}
          >
            {saving ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
