import { useEffect, useMemo, useState } from "react";
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
import SearchableSelect from "./SearchableSelect";
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
const formatServiceDate = (value, fallback = "") =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : fallback;
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
    if (Array.isArray(saved) && saved.length) return saved;
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
        visible: fallback.locked ? true : column.visible !== false,
      };
    });
  const present = new Set(mapped.map((column) => column.id));
  return [
    ...mapped,
    ...REPASSE_COLUMNS.filter((column) => !present.has(column.id)).map(
      (column) => ({ ...column, visible: true }),
    ),
  ];
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
export default function App() {
  const [services, setServices] = useState([]);
  const [favorecidos, setFavorecidos] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [links, setLinks] = useState([]);
  const [lots, setLots] = useState([]);
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState(monthRange);
  const [search, setSearch] = useState("");
  const [driverId, setDriverId] = useState("");
  const [favorecidoFilter, setFavorecidoFilter] = useState("");
  const [saving, setSaving] = useState({});
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lotDetail, setLotDetail] = useState(null);
  const [preselected, setPreselected] = useState(new Set());
  const busy = (key) => Boolean(saving[key]);
  const setBusy = (key, value) =>
    setSaving((current) => ({ ...current, [key]: value }));
  async function refresh() {
    setBusy("refresh", true);
    try {
      const [serviceRows, favorecidoRows, driverRows, linkRows, lotRows] =
        await Promise.all([
          dataverse.listFinanceServices(range),
          dataverse.listFavorecidos(true),
          dataverse.listDrivers(),
          dataverse.listLinks(),
          dataverse.listAll("cr40f_pagamentoaterceiro"),
        ]);
      setServices(serviceRows);
      setFavorecidos(favorecidoRows);
      setDrivers(driverRows);
      setLinks(linkRows);
      setLots(lotRows);
    } catch (err) {
      setError(err.message);
    } finally {
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
          (!driverId || service.motoristaId === driverId) &&
          (!favorecidoFilter || service.favorecidoId === favorecidoFilter) &&
          (!search ||
            `${service.identificador} ${service.motorista} ${service.trajeto}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [services, driverId, favorecidoFilter, search],
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
      throw err;
    } finally {
      setBusy(`repasse-${service.id}`, false);
    }
  }
  async function linkService(service, favorecidoId) {
    setBusy(`link-${service.id}`, true);
    try {
      const saved = await dataverse.setPreferredFavorecido(
        service.id,
        favorecidoId,
      );
      setServices((rows) =>
        rows.map((row) => (row.id === service.id ? { ...row, ...saved } : row)),
      );
      setLinks(await dataverse.listLinks());
      setPreselected((current) => new Set(current).add(service.id));
      setNotice("Vínculo criado e serviço pré-selecionado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(`link-${service.id}`, false);
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
  async function markPaid(lot, proofUrl) {
    setBusy(`pay-${lot.id}`, true);
    try {
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <Nav tab={tab} onChange={setTab} />
        <button
          className="primary-button sidebar-create"
          onClick={() => setDrawer({ type: "lot" })}
        >
          <Plus size={16} />
          Novo lote
        </button>
        <div className="sidebar-foot">
          <span className="connection-dot mock" />
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
          >
            <RefreshCw size={17} className={busy("refresh") ? "spin" : ""} />
          </button>
        </header>
        <div className="content-wrap">
          <div className="desktop-actions">
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
            <button className="icon-button" onClick={refresh}>
              <RefreshCw size={15} className={busy("refresh") ? "spin" : ""} />
              Atualizar
            </button>
          </div>
          {error && (
            <Alert tone="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {notice && <Alert tone="success">{notice}</Alert>}
          {tab === "overview" && (
            <OverviewView
              services={services}
              lots={lots}
              links={links}
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
              driverId={driverId}
              setDriverId={setDriverId}
              favorecidoFilter={favorecidoFilter}
              setFavorecidoFilter={setFavorecidoFilter}
              busy={busy}
              onSaveRepasse={saveRepasse}
              onLink={linkService}
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
          onClose={() => setDrawer(null)}
          onSave={async (id) => {
            await dataverse.upsertLink(id, drawer.favorecido.id);
            await refresh();
          }}
          onDeactivate={async (id) => {
            await dataverse.setLinkStatus(id, "inativo");
            await refresh();
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
      >
        <LayoutDashboard size={17} />
        Visão geral
      </button>
      <button
        className={tab === "payments" ? "active" : ""}
        onClick={() => onChange("payments")}
      >
        <CircleDollarSign size={17} />
        Lançar repasses
      </button>
      <button
        className={tab === "lots" ? "active" : ""}
        onClick={() => onChange("lots")}
      >
        <ClipboardList size={17} />
        Lotes de pagamento
      </button>
      <button
        className={tab === "favorecidos" ? "active" : ""}
        onClick={() => onChange("favorecidos")}
      >
        <UsersRound size={17} />
        Terceiros Favorecidos
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
  lots,
  links,
  onNavigate,
  onNewLot,
  onNewFavorecido,
}) {
  const completedServices = services.filter(
    (service) => service.status === "concluido",
  );
  const totals = paymentTotals(completedServices);
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
  const totalMargin = totals.marginPercent.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section className="page-section overview-page">
      <div className="page-title">
        <div>
          <span>Financeiro operacional</span>
          <h1>Visão geral</h1>
          <p>Prioridades do período, sem misturar lançamento, lote e cadastro.</p>
        </div>
      </div>

      <section className="metrics-grid" aria-label="Resumo financeiro">
        <OverviewMetric
          tone="blue"
          icon={<Banknote size={20} />}
          label="Total CP"
          value={money(totals.revenue)}
          detail={`${totals.count} serviço(s) concluído(s)`}
        />
        <OverviewMetric
          tone="green"
          icon={<CircleDollarSign size={20} />}
          label="Repasses lançados"
          value={money(totals.repasse)}
          detail={`${totalMargin}% no período`}
        />
        <OverviewMetric
          tone="amber"
          icon={<AlertTriangle size={20} />}
          label="Aguardando repasse"
          value={String(pendingRepasse.length)}
          detail="serviços sem valor definido"
        />
        <OverviewMetric
          tone="blue"
          icon={<ClipboardList size={20} />}
          label="Lotes em aberto"
          value={String(openLots.length)}
          detail="rascunhos ainda não pagos"
        />
      </section>

      <div className="dashboard-grid overview-grid">
        <section className="surface priority-panel">
          <div className="surface-head">
            <div>
              <span>Próximas ações</span>
              <h2>O que precisa de atenção</h2>
            </div>
          </div>
          <div className="overview-queue">
            <OverviewQueueRow
              tone={pendingRepasse.length ? "warning" : "success"}
              title="Lançar repasses"
              description={
                pendingRepasse.length
                  ? `${pendingRepasse.length} serviço(s) aguardando valor.`
                  : "Todos os serviços concluídos têm repasse informado."
              }
              action="Abrir"
              onClick={() => onNavigate("payments")}
            />
            <OverviewQueueRow
              tone={readyServices.length ? "info" : "neutral"}
              title="Montar lote"
              description={
                readyServices.length
                  ? `${readyServices.length} serviço(s) disponível(is) para reserva.`
                  : "Não há serviços elegíveis para um novo lote."
              }
              action="Novo lote"
              onClick={onNewLot}
            />
            <OverviewQueueRow
              tone={documentAttention.length ? "warning" : "success"}
              title="Documentos de pagamento"
              description={
                documentAttention.length
                  ? `${documentAttention.length} lote(s) precisam de geração ou reenvio.`
                  : "Nenhum documento pendente."
              }
              action="Ver lotes"
              onClick={() => onNavigate("lots")}
            />
          </div>
        </section>

        <section className="surface category-panel overview-shortcuts">
          <div className="surface-head">
            <div>
              <span>Atalhos</span>
              <h2>Ir direto ao trabalho</h2>
            </div>
          </div>
          <button className="overview-shortcut" onClick={onNewLot}>
            <span className="overview-shortcut-icon"><Plus size={17} /></span>
            <span><strong>Novo lote</strong><small>Reserve serviços e confira os totais.</small></span>
            <ChevronRight size={16} />
          </button>
          <button className="overview-shortcut" onClick={onNewFavorecido}>
            <span className="overview-shortcut-icon"><UsersRound size={17} /></span>
            <span><strong>Cadastrar terceiro</strong><small>Inclua PIX e vínculos de motorista.</small></span>
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
    </section>
  );
}

function OverviewMetric({ tone, icon, label, value, detail }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
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
  driverId,
  setDriverId,
  favorecidoFilter,
  setFavorecidoFilter,
  busy,
  onSaveRepasse,
  onLink,
}) {
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
          <label>
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
          <label>
            <span>Até</span>
            <input
              type="date"
              value={range.to}
              onChange={(event) =>
                setRange((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Motorista</span>
            <select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
            >
              <option value="">Todos</option>
              {drivers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Favorecido</span>
            <select
              value={favorecidoFilter}
              onChange={(event) => setFavorecidoFilter(event.target.value)}
            >
              <option value="">Todos</option>
              {favorecidos.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <RepasseGrid
        services={services.filter((row) => row.status === "concluido")}
        favorecidos={allFavorecidos}
        links={links}
        busy={busy}
        onSave={onSaveRepasse}
        onLink={onLink}
      />
    </section>
  );
}
function RepasseGrid({ services, favorecidos, links, busy, onSave, onLink }) {
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
  const [resize, setResize] = useState(null);
  const [sort, setSort] = useState({ id: "dataServico", direction: "desc" });
  const visibleColumns = columns.filter((column) => column.visible);
  const template = visibleColumns
    .map((column) => `${column.width}px`)
    .join(" ");
  const pendingCount = services.filter(
    (service) => service.valorRepasse <= 0,
  ).length;
  const pickerColumns = columns.filter((column) =>
    column.label.toLowerCase().includes(columnSearch.toLowerCase()),
  );
  const activeView = views.find((view) => view.id === activeViewId);
  const currentView = () => ({
    columns: columns.map(({ id, width, visible }) => ({ id, width, visible })),
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
  const pinnedLeft = (columnId) =>
    visibleColumns
      .slice(
        0,
        visibleColumns.findIndex((column) => column.id === columnId),
      )
      .filter((column) => column.locked)
      .reduce((total, column) => total + column.width, 0);
  const pinnedStyle = (column) =>
    column.locked ? { left: `${pinnedLeft(column.id)}px` } : undefined;

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

  const reorderColumns = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    setColumns((current) => {
      const source = current.findIndex((column) => column.id === sourceId);
      const target = current.findIndex((column) => column.id === targetId);
      if (current[source].locked || current[target].locked) return current;
      const next = [...current];
      next.splice(target, 0, next.splice(source, 1)[0]);
      return next;
    });
  };
  const moveColumn = (targetId) => {
    reorderColumns(draggedColumn, targetId);
    setDraggedColumn("");
  };
  const toggleColumn = (id) =>
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, visible: !column.visible } : column,
      ),
    );
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
    const target =
      columns[columns.findIndex((column) => column.id === id) + direction];
    if (!target) return;
    reorderColumns(id, target.id);
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
    const linked = links.some(
      (link) =>
        link.status === "ativo" &&
        link.motoristaId === service.motoristaId &&
        link.favorecidoId === service.favorecidoId,
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
          linked={linked}
          saving={busy(`link-${service.id}`)}
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
          <div className="saved-view-wrap">
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
          <div className="column-picker-wrap">
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
                <div>
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
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={column.visible}
                      disabled={column.locked}
                      onChange={() => toggleColumn(column.id)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="repasse-grid-scroll">
        <div
          className="repasse-grid"
          style={{
            gridTemplateColumns: template,
            minWidth: template ? undefined : 0,
          }}
        >
          <div
            className="repasse-grid-head"
            style={{ gridTemplateColumns: template }}
          >
            {visibleColumns.map((column) => (
              <div
                className={`repasse-grid-header ${column.locked ? "is-pinned" : ""}`}
                key={column.id}
                style={pinnedStyle(column)}
                draggable={!column.locked}
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
          {sortedServices.map((service) => (
            <div
              className={`repasse-grid-row ${service.valorRepasse <= 0 ? "is-pending" : ""}`}
              key={service.id}
              style={{ gridTemplateColumns: template }}
            >
              {visibleColumns.map((column) => (
                <div
                  className={`repasse-grid-cell cell-${column.id} ${column.locked ? "is-pinned" : ""}`}
                  key={column.id}
                  style={pinnedStyle(column)}
                >
                  {cell(service, column)}
                </div>
              ))}
            </div>
          ))}
          {!services.length && (
            <div className="empty-state">
              <FileText size={28} />
              <strong>Nenhum serviço no período</strong>
              <span>Amplie o intervalo ou ajuste os filtros.</span>
            </div>
          )}
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
    if (!feedback || feedback.type === "saving") return undefined;
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
      setFeedback({ type: "error", message: err.message });
    }
  };
  const status = saving ? { type: "saving" } : feedback;
  return (
    <div className="grid-money-input">
      <input
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setFeedback(null);
        }}
        onBlur={save}
        aria-label={`Repasse de ${service.identificador}`}
      />
      <small className={`repasse-margin ${marginTone}`}>
        {currentMargin.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
        %
      </small>
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
        <button
          type="button"
          className="repasse-save-icon is-error"
          title={`${status.message} Clique para tentar novamente.`}
          aria-label="Repasse não salvo. Tentar novamente"
          onMouseDown={(event) => event.preventDefault()}
          onClick={save}
        >
          <AlertTriangle size={13} aria-hidden="true" />
        </button>
      )}
      {!status && !changed && value <= 0 && (
        <small className="field-error">Pendente</small>
      )}
    </div>
  );
}
function FavorecidoCell({ service, favorecidos, linked, saving, onLink }) {
  if (linked && service.favorecidoId) {
    const favorecido = favorecidos.find(
      (row) => row.id === service.favorecidoId,
    );
    return (
      <div className="favorecido-linked">
        <Badge tone="green">Vinculado</Badge>
        <span title={favorecido?.nome || "Favorecido"}>
          {favorecido?.nome || "Favorecido"}
        </span>
      </div>
    );
  }
  return (
    <SearchableSelect
      value=""
      disabled={saving}
      placeholder="Vincular favorecido"
      aria-label={`Vincular favorecido de ${service.identificador}`}
      className="repasse-favorecido-select"
      options={[
        { value: "", label: "Vincular favorecido" },
        ...favorecidos.map((row) => ({
          value: row.id,
          label: row.nome,
          search: `${row.documento || ""} ${row.email || ""}`,
        })),
      ]}
      onChange={(value) => value && onLink(service, value)}
    />
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
      <section className="surface lots-panel">
        {lots.map((lot) => (
          <button className="lot-row" key={lot.id} onClick={() => onOpen(lot)}>
            <div>
              <strong>{lot.identifier}</strong>
              <span>
                {lot.favorecido?.nome ||
                  JSON.parse(lot.favorecidoSnapshot || "{}").nome ||
                  "Terceiro Favorecido"}
              </span>
            </div>
            <strong>{money(lot.repasse)}</strong>
            <Badge
              tone={
                lot.paymentStatus === PAYMENT_STATUS.PAID ? "green" : "blue"
              }
            >
              {statusText(lot)}
            </Badge>
            <ChevronRight size={16} />
          </button>
        ))}
        {!lots.length && (
          <div className="empty-small">Nenhum lote criado neste ambiente.</div>
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
      <section className="surface favorecido-list">
        {favorecidos.map((row) => {
          const count = links.filter(
            (link) => link.favorecidoId === row.id && link.status === "ativo",
          ).length;
          return (
            <article className="favorecido-row" key={row.id}>
              <div>
                <strong>{row.nome}</strong>
                <span>
                  {row.tipoPessoa} · {row.documento} · PIX{" "}
                  {maskPix(row.chavePix)}
                </span>
                <small>{count} motorista(s) ativo(s)</small>
              </div>
              <Badge tone={row.status === "ativo" ? "green" : "neutral"}>
                {row.status}
              </Badge>
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
        <label>
          <span>Nome ou razão social *</span>
          <input
            value={form.nome}
            onChange={(event) => set("nome", event.target.value)}
            autoFocus
          />
          {errors.nome && <small className="field-error">{errors.nome}</small>}
        </label>
        <div className="form-grid">
          <label>
            <span>Tipo</span>
            <select
              value={form.tipoPessoa}
              onChange={(event) => set("tipoPessoa", event.target.value)}
            >
              <option>PF</option>
              <option>PJ</option>
            </select>
          </label>
          <label>
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
          <label>
            <span>Tipo da chave PIX</span>
            <select
              value={form.tipoChavePix}
              onChange={(event) => set("tipoChavePix", event.target.value)}
            >
              <option>CPF/CNPJ</option>
              <option>E-mail</option>
              <option>Telefone</option>
              <option>Aleatória</option>
            </select>
          </label>
          <label>
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
        <label>
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
        <label>
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
        <label>
          <span>Adicionar motorista</span>
          <select
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <option value="">Selecione</option>
            {drivers
              .filter(
                (row) => !active.some((link) => link.motoristaId === row.id),
              )
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nome}
                </option>
              ))}
          </select>
        </label>
        <button
          className="primary-button"
          disabled={!driverId}
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
  existingLot,
  saving,
  onClose,
  onSave,
}) {
  const [favorecidoId, setFavorecidoId] = useState(
    existingLot?.favorecidoId || favorecidos[0]?.id || "",
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
                (preselected.has(row.id) || row.favorecidoId === favorecidoId)),
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
        <label>
          <span>Terceiro Favorecido</span>
          <select
            value={favorecidoId}
            onChange={(event) => setFavorecidoId(event.target.value)}
          >
            {favorecidos.map((row) => (
              <option key={row.id} value={row.id}>
                {row.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            <span>De</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
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
                <strong>{service.identificador}</strong>
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
                <strong>{item.identificador}</strong>
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
                <label className="proof-input">
                  <span>Comprovante opcional</span>
                  <input
                    value={proofUrl}
                    onChange={(event) => setProofUrl(event.target.value)}
                    placeholder="URL interna do comprovante"
                  />
                </label>
                <button
                  disabled={busy(`pay-${lot.id}`)}
                  onClick={() => onPay(lot, proofUrl)}
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
        <label>
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
