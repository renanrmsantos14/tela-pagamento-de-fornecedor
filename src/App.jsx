import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileDown,
  FileText,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Undo2,
  UsersRound,
  X,
} from "lucide-react";
import { dataverse } from "./lib/dataverse";
import { buildPaymentPdf } from "./lib/document";
import {
  DOCUMENT_STATUS,
  LOT_STATUS,
  PAYMENT_STATUS,
  canCancel,
  canPay,
  canRevert,
  eligibleServices,
  groupMonthly,
  marginPercent,
  money,
  moneyInput,
  parseMoney,
  paymentTotals,
  profit,
  validateFavorecido,
} from "./domain/payment";

const months = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
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
const maskPix = (value) =>
  value?.length > 8 ? `${value.slice(0, 3)}••••${value.slice(-3)}` : value;

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
function Metric({ label, value, note, tone = "blue" }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">
        <CircleDollarSign size={20} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

export default function App() {
  const [services, setServices] = useState([]);
  const [favorecidos, setFavorecidos] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [links, setLinks] = useState([]);
  const [lots, setLots] = useState([]);
  const [tab, setTab] = useState("payments");
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
  const totals = useMemo(
    () => paymentTotals(visibleServices),
    [visibleServices],
  );
  const missingRepasse = visibleServices.filter(
    (service) => service.status === "concluido" && service.valorRepasse <= 0,
  ).length;
  const negative = visibleServices.filter(
    (service) => profit(service) < 0,
  ).length;
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
      setNotice(`Repasse de ${service.identificador} salvo.`);
    } catch (err) {
      setError(err.message);
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
          {dataverse.mockMode && (
            <MockControls
              onFailure={(key) => {
                dataverse.setMockFailure(key);
                setNotice(`Próxima operação: falha simulada em ${key}.`);
              }}
            />
          )}
          {error && (
            <Alert tone="error" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {notice && <Alert tone="success">{notice}</Alert>}
          {tab === "payments" && (
            <PaymentsView
              services={visibleServices}
              drivers={drivers}
              favorecidos={activeFavorecidos}
              links={links}
              range={range}
              setRange={setRange}
              search={search}
              setSearch={setSearch}
              driverId={driverId}
              setDriverId={setDriverId}
              favorecidoFilter={favorecidoFilter}
              setFavorecidoFilter={setFavorecidoFilter}
              totals={totals}
              missingRepasse={missingRepasse}
              negative={negative}
              busy={busy}
              onSaveRepasse={saveRepasse}
              onLink={linkService}
              onLot={() => setDrawer({ type: "lot" })}
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
          className={tab === "payments" ? "active" : ""}
          onClick={() => setTab("payments")}
        >
          <CircleDollarSign size={18} />
          <span>Carteira</span>
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
        className={tab === "payments" ? "active" : ""}
        onClick={() => onChange("payments")}
      >
        <CircleDollarSign size={17} />
        Carteira financeira
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
function MockControls({ onFailure }) {
  return (
    <section className="mock-controls" aria-label="Cenários de teste local">
      <span>Cenários locais</span>
      {[
        ["repasse", "Falhar repasse"],
        ["reserve", "Colidir reserva"],
        ["onedrive", "Falhar OneDrive"],
        ["email", "Falhar e-mail"],
      ].map(([key, label]) => (
        <button key={key} type="button" onClick={() => onFailure(key)}>
          {label}
        </button>
      ))}
    </section>
  );
}

function PaymentsView({
  services,
  drivers,
  favorecidos,
  links,
  range,
  setRange,
  search,
  setSearch,
  driverId,
  setDriverId,
  favorecidoFilter,
  setFavorecidoFilter,
  totals,
  missingRepasse,
  negative,
  busy,
  onSaveRepasse,
  onLink,
  onLot,
}) {
  const monthly = groupMonthly(services, Number(range.from.slice(0, 4)));
  return (
    <section className="page-section">
      <div className="page-title">
        <div>
          <span>Financeiro / operação</span>
          <h1>Carteira de repasses</h1>
          <p>
            Preencha valores, veja lucro real e prepare lotes sem sair da tela.
          </p>
        </div>
        <button className="primary-button" onClick={onLot}>
          <Plus size={16} />
          Montar lote
        </button>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Receita"
          value={money(totals.revenue)}
          note={`${totals.count} serviços no filtro`}
        />
        <Metric
          label="Repasse"
          value={money(totals.repasse)}
          note="Atualização em tempo real"
          tone="green"
        />
        <Metric
          label="Lucro"
          value={money(totals.margin)}
          note={`Margem ${totals.marginPercent.toFixed(1)}%`}
          tone={totals.margin < 0 ? "amber" : "blue"}
        />
        <Metric
          label="Pendências"
          value={missingRepasse}
          note={
            negative
              ? `${negative} margem(ns) negativa(s)`
              : "Sem margem negativa"
          }
          tone={missingRepasse || negative ? "amber" : "green"}
        />
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
      <section className="surface table-surface finance-list">
        <div className="finance-head">
          <span>Serviço</span>
          <span>Repasse</span>
          <span>Lucro / margem</span>
          <span>Favorecido</span>
        </div>
        {services
          .filter((row) => row.status === "concluido")
          .map((service) => (
            <ServiceFinanceRow
              key={service.id}
              service={service}
              favorecidos={favorecidos}
              linked={links.some(
                (link) =>
                  link.status === "ativo" &&
                  link.motoristaId === service.motoristaId &&
                  link.favorecidoId === service.favorecidoId,
              )}
              saving={
                busy(`repasse-${service.id}`) || busy(`link-${service.id}`)
              }
              onSave={onSaveRepasse}
              onLink={onLink}
            />
          ))}
        {!services.length && (
          <div className="empty-state">
            <FileText size={28} />
            <strong>Nenhum serviço no período</strong>
            <span>Amplie o intervalo ou ajuste os filtros.</span>
          </div>
        )}
      </section>
      <section className="surface priority-panel monthly-mini">
        <div className="surface-head">
          <div>
            <span>Visão anual</span>
            <h2>Movimento por mês</h2>
          </div>
        </div>
        <div className="monthly-table">
          <div className="monthly-head">
            <span>Mês</span>
            <span>Serviços</span>
            <span>Receita</span>
            <span>Repasse</span>
            <span>Lucro</span>
          </div>
          {monthly.map((row) => (
            <div className="monthly-row" key={row.month}>
              <strong>{months[row.month]}</strong>
              <span>{row.count}</span>
              <span>{money(row.revenue)}</span>
              <span>{money(row.repasse)}</span>
              <span>{money(row.margin)}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
function ServiceFinanceRow({
  service,
  favorecidos,
  linked,
  saving,
  onSave,
  onLink,
}) {
  const [draft, setDraft] = useState(moneyInput(service.valorRepasse));
  useEffect(
    () => setDraft(moneyInput(service.valorRepasse)),
    [service.valorRepasse],
  );
  const currentProfit = profit({ ...service, valorRepasse: parseMoney(draft) });
  const currentMargin = marginPercent({
    ...service,
    valorRepasse: parseMoney(draft),
  });
  const pending = parseMoney(draft) <= 0;
  return (
    <article className={`finance-row ${currentProfit < 0 ? "negative" : ""}`}>
      <div className="service-main">
        <span className="service-line" />
        <div>
          <strong>{service.identificador}</strong>
          <span>
            {new Date(service.dataServico).toLocaleDateString("pt-BR")} ·{" "}
            {service.motorista} · {service.trajeto}
          </span>
        </div>
      </div>
      <label className="inline-money">
        <span>Repasse</span>
        <input
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onSave(service, draft)}
          aria-label={`Repasse de ${service.identificador}`}
        />
        {saving && <small>Salvando…</small>}
      </label>
      <div className="profit-cell">
        <span>{money(currentProfit)}</span>
        <small>{currentMargin.toFixed(1)}% de margem</small>
        {currentProfit < 0 && (
          <b>
            <AlertTriangle size={13} /> Margem negativa permitida
          </b>
        )}
      </div>
      <div className="beneficiary-cell">
        {linked && service.favorecidoId ? (
          <Badge tone="green">Vinculado</Badge>
        ) : (
          <select
            value=""
            disabled={saving}
            onChange={(event) =>
              event.target.value && onLink(service, event.target.value)
            }
          >
            <option value="">Vincular favorecido</option>
            {favorecidos.map((row) => (
              <option key={row.id} value={row.id}>
                {row.nome}
              </option>
            ))}
          </select>
        )}
        {pending && <small className="field-error">Repasse pendente</small>}
      </div>
    </article>
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
            Este lote possui margem negativa, mas pode ser criado.
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
            {money(lot.repasse)} · {lot.count} serviço(s) · margem{" "}
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
