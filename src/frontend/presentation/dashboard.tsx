"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Plus,
  Factory,
  RefreshCw,
  Wifi,
  WifiOff,
  Pencil,
  History,
  Download,
  Database,
  BarChart3,
  ClipboardList,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/src/frontend/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/frontend/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/frontend/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/src/frontend/components/ui/empty";
import { useFpy } from "@/src/frontend/application/use-fpy";
import {
  summarize,
  isoWeek,
  canCorrect,
  type Entry,
} from "@/src/shared/domain/fpy";
import { fetchJson, visibleEntries } from "@/src/frontend/infrastructure/offline";
import { createCsvExport, downloadCsv } from "@/src/frontend/application/csv";
import { filterFpyEntries, localDate, periodRange, periodYears, type FpyPeriod } from "@/src/frontend/application/fpy-filters";
import { FpyFilters } from "./fpy-filters";
import { EntryForm } from "./entry-form";
import UserManagement, { UserEditor, PasswordEditor } from "./user-management";
import Login from "./login";
import CatalogManagement from "./catalog-management";
import AnalyticsDashboard from "./analytics-dashboard";
import { ActionPlanWorkspace } from "./action-plan";
const percent = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const number = (v: number) => v.toLocaleString("pt-BR");
const roleLabel: Record<string, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  lider: "Líder",
  tecnica: "Técnica",
  qualidade: "Qualidade",
  engenharia: "Engenharia",
};
type InstallPrompt = Event & { prompt: () => Promise<void> };
type HistoryItem = {
  id: string;
  actor: string;
  at: string;
  reason: string;
  before: string;
  after: string;
};
const subscribeToClient = () => () => {};
function useClientReady() {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}
export default function Dashboard() {
  const clientReady = useClientReady();
  const app = useFpy();
  const setAppMessage = app.setMessage;
  const [loginOpen, setLoginOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false);
  const [area, setArea] = useState<"fpy" | "action-plans" | "dashboard" | "management">("fpy"),
    [tab, setTab] = useState("fpy"),
    [managementTab, setManagementTab] = useState("sync"),
    [form, setForm] = useState<{
      kind: "production" | "defect";
      entry?: Entry;
    } | null>(null),
    [search, setSearch] = useState(""),
    [shift, setShift] = useState("all"),
    [line, setLine] = useState("all"),
    [period, setPeriod] = useState<FpyPeriod>(`year:${app.year}`),
    [customRange, setCustomRange] = useState({ from: "", to: "" }),
    [limit, setLimit] = useState(100),
    [history, setHistory] = useState<HistoryItem[] | null>(null),
    [install, setInstall] = useState<InstallPrompt | null>(null),
    [backup, setBackup] = useState(""),
    [adminBusy, setAdminBusy] = useState(false),
    [discardId, setDiscardId] = useState<string | null>(null);
  useEffect(() => {
    let removeUpdateListener: (() => void) | undefined;
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "production") {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        ),
        caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("fpy-shell-")).map((key) => caches.delete(key))),
        ),
      ]).then(() => {
        if (navigator.serviceWorker.controller && !sessionStorage.getItem("fpy-sw-cleaned")) {
          sessionStorage.setItem("fpy-sw-cleaned", "1");
          location.reload();
        }
      });
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      let refreshing = false;
      const reload = () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reload);
      removeUpdateListener = () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
      void navigator.serviceWorker
        .register("/sw.js?v=2", { updateViaCache: "none" })
        .then(async (registration) => {
          await registration.update();
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller)
                worker.postMessage({ type: "SKIP_WAITING" });
            });
          });
          await navigator.serviceWorker.ready;
          const assets = performance
            .getEntriesByType("resource")
            .map((r) => r.name)
            .filter(
              (url) =>
                new URL(url).origin === location.origin &&
                /\.(js|css|svg|png|woff2?)$/.test(new URL(url).pathname),
            );
          registration.active?.postMessage({
            type: "CACHE_ASSETS",
            urls: assets,
          });
        })
        .catch(() =>
          setAppMessage(
            "Não foi possível ativar a abertura offline. Tente recarregar.",
          ),
        );
    }
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      removeUpdateListener?.();
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, [setAppMessage]);
  const today = localDate(new Date());
  const range = periodRange(period, customRange, today);
  const selectedYears = periodYears(range);
  const missingYears = selectedYears.filter((year) => !app.local?.years[year]);
  const rangeError = !selectedYears.length
    ? "Informe um período válido, com a data inicial antes da final (até 12 anos)."
    : "";
  const periodEntries = missingYears.length ? [] : selectedYears.flatMap((year) => app.local ? visibleEntries(app.local, year) : []);
  const lines = [...new Set(periodEntries.filter((entry) => entry.date >= range.from && entry.date <= range.to).map((entry) => entry.line))].sort();
  const selectedLine = lines.includes(line) ? line : "all";
  const filters = { ...range, shift, line: selectedLine, search };
  const entries = filterFpyEntries(periodEntries, filters, tab === "defects");
  // FPY uses context filters only: code/position searching must never remove some defects from its denominator.
  const contexts = filterFpyEntries(periodEntries, filters, false);
  const groups = summarize(contexts),
    pendingIds = new Set(app.local?.pending.map((p) => p.mutation.entry.id));
  const canEdit = app.local && canCorrect(app.local.user.role);
  const availableYears = [...new Set([
    ...Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() - i)),
    ...Object.keys(app.local?.years || {}),
    ...(period.startsWith("year:") ? [period.slice(5)] : []),
  ])].sort().reverse();
  function changePeriod(nextPeriod: FpyPeriod, nextRange = customRange) {
    if (nextPeriod === "custom" && period !== "custom") nextRange = range;
    setPeriod(nextPeriod);
    setCustomRange(nextRange);
    setLine("all");
    setLimit(100);
    const years = periodYears(periodRange(nextPeriod, nextRange, today));
    if (years.length) {
      app.setYear(years[years.length - 1]);
      void app.syncYears(years);
    }
  }
  function changeTab(value: string) {
    if (tab === "defects" && value !== "defects") setSearch("");
    setTab(value);
    setLimit(100);
  }
  async function showHistory(e: Entry) {
    try {
      setHistory((await fetchJson("/api/history?id=" + e.id)) as HistoryItem[]);
    } catch (err) {
      app.setMessage((err as Error).message);
    }
  }
  async function admin(action: () => Promise<void>) {
    setAdminBusy(true);
    try {
      await action();
    } catch (e) {
      app.setMessage((e as Error).message);
    } finally {
      setAdminBusy(false);
    }
  }
  const codes = new Map<string, number>();
  contexts
    .filter((e) => e.kind === "defect")
    .forEach((e) => codes.set(e.code, (codes.get(e.code) || 0) + e.quantity));
  const pareto = [...codes].sort((a, b) => b[1] - a[1]).slice(0, 5);
  function exportSelectedTable() {
    if (!["fpy", "defects", "production"].includes(tab) || missingYears.length || rangeError) return;
    const result = createCsvExport(
      tab as "fpy" | "defects" | "production",
      entries,
      groups,
      pendingIds,
      period.startsWith("year:") ? period.slice(5) : `${range.from}_${range.to}`,
    );
    downloadCsv(result.filename, result.content);
  }
  const recordTable = (kind: "production" | "defect") => {
    const list = entries.filter((e) => e.kind === kind);
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Data",
                "Turno",
                "Linha",
                "PN / Modelo",
                "Interno / categoria original",
                "Class. CC",
                ...(kind === "defect" ? ["Código", "Posição"] : []),
                "Quantidade",
                "Responsável",
                "Estado",
                ...(canEdit ? ["Ações"] : []),
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.slice(0, limit).map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.date.split("-").reverse().join("/")}</TableCell>
                <TableCell>{e.shift}º</TableCell>
                <TableCell>{e.line}</TableCell>
                <TableCell>
                  <b>{e.pn}</b>
                  <small className="cell-sub">{e.model}</small>
                </TableCell>
                <TableCell>{e.category || "—"}</TableCell>
                <TableCell>{e.classCc || "—"}</TableCell>
                {kind === "defect" && (
                  <>
                    <TableCell title={e.description}>
                      {e.code}
                      <small className="cell-sub">{e.description}</small>
                    </TableCell>
                    <TableCell>{e.position}</TableCell>
                  </>
                )}
                <TableCell>{number(e.quantity)}</TableCell>
                <TableCell>{e.author}</TableCell>
                <TableCell>
                  <span
                    className={
                      "badge " + (pendingIds.has(e.id) ? "warning" : "")
                    }
                  >
                    {pendingIds.has(e.id) ? "Pendente" : "Sincronizado"}
                  </span>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        disabled={pendingIds.has(e.id)}
                        aria-label={"Corrigir " + e.pn}
                        onClick={() => setForm({ kind, entry: e })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"Histórico " + e.pn}
                        onClick={() => showHistory(e)}
                        disabled={!app.online}
                      >
                        <History size={16} />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!list.length &&
          empty(
            "Nenhum lançamento neste período",
            "Ajuste os filtros ou registre o primeiro lançamento.",
          )}
        {list.length > limit && (
          <button
            className="secondary more"
            onClick={() => setLimit(limit + 100)}
          >
            Mostrar mais 100 registros
          </button>
        )}
      </>
    );
  };
  function empty(title: string, description: string) {
    return (
      <Empty className="empty">
        <EmptyHeader>
          <Factory size={32} />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (!clientReady) return null;
  return (
    <main className="workspace">
      <header className="topbar">
        <Image
          src="/inventus-power-logo.svg"
          alt="Inventus Power"
          width={166}
          height={48}
        />
        <span className="system-name">
          QUALIDADE <b>Gestão de FPY</b>
        </span>
      </header>
      <nav className="primary-navigation" aria-label="Navegação principal">
        <div>
          <button
            className={area === "fpy" ? "active" : ""}
            onClick={() => {
              setArea("fpy");
              if (!["fpy", "defects", "production"].includes(tab)) changeTab("fpy");
            }}
          >
            <ClipboardList size={19} /> <span>FPY</span>
          </button>
          <button
            className={area === "action-plans" ? "active" : ""}
            onClick={() => {
              setArea("action-plans");
              changeTab("action-plans");
            }}
          >
            <ClipboardCheck size={19} /> <span>Plano de Ação</span>
          </button>
          <button
            className={area === "dashboard" ? "active" : ""}
            onClick={() => setArea("dashboard")}
          >
            <BarChart3 size={19} /> <span>Dashboard</span>
          </button>
          <button
            className={area === "management" ? "active" : ""}
            onClick={() => {
              setArea("management");
              changeTab(managementTab);
            }}
          >
            <Settings size={19} /> <span>Gestão</span>
            {!!app.local?.pending.length && (
              <i aria-label={`${app.local.pending.length} envios pendentes`}>
                {app.local.pending.length}
              </i>
            )}
          </button>
        </div>
      </nav>
      <section className="content">
        <div className="statusbar">
          <span className={"connection " + (!app.online ? "offline" : "")}>
            {app.online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
            {app.online ? "Rede disponível" : "Sem conexão"}
            {app.local?.years[app.year] && (
              <small>
                Atualizado em{" "}
                {new Date(app.local.years[app.year].at).toLocaleString("pt-BR")}
              </small>
            )}
          </span>
          <div className="account">
            {app.local && (
              <>
                <span>
                  {app.local.user.name}
                  <small>
                    {app.local.user.owner
                      ? "Administrador principal"
                      : roleLabel[app.local.user.role]}
                  </small>
                </span>
                <div className="user-toolbar">
                  <button
                    className="secondary"
                    disabled={!app.online}
                    onClick={() => setProfileOpen(true)}
                  >
                    Meu perfil
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setLoginOpen(true)}
                  >
                    Trocar conta
                  </button>
                </div>
              </>
            )}
            {install && (
              <button
                className="secondary"
                onClick={async () => {
                  await install.prompt();
                  setInstall(null);
                }}
              >
                <Download size={16} /> Instalar
              </button>
            )}
          </div>
        </div>
        <div className="heading">
          <div>
            <p className="eyebrow">CONTROLE DE QUALIDADE</p>
            <h1>
              {area === "fpy"
                ? "Registros de FPY"
                : area === "action-plans"
                  ? "Plano de Ação"
                : area === "dashboard"
                  ? "Indicadores da operação"
                  : "Gestão do sistema"}
            </h1>
            <p>
              {area === "fpy"
                ? "Consulte e registre produção e defeitos por turno."
                : area === "action-plans"
                  ? "Acompanhe a evidência da Qualidade e as ações da Engenharia."
                : area === "dashboard"
                  ? "Acompanhe produção, defeitos e rendimento em uma visão consolidada."
                  : "Controle a sincronização, os usuários e a segurança dos dados."}
            </p>
          </div>
          {area === "fpy" && <div className="actions">
            <button
              className="secondary"
              disabled={!app.local}
              onClick={() => setForm({ kind: "production" })}
            >
              <Factory size={18} /> Informar produção
            </button>
            <button
              disabled={!app.local}
              onClick={() => setForm({ kind: "defect" })}
            >
              <Plus size={19} /> Lançar defeitos
            </button>
          </div>}
        </div>
        {app.message && (
          <div role="status" className="notice">
            {app.message}
            {app.local && /conta|sessão/i.test(app.message) && (
              <button
                className="text-button"
                onClick={() => setLoginOpen(true)}
              >
                Entrar novamente
              </button>
            )}
            <button
              className="text-button"
              onClick={() => app.setMessage("")}
              aria-label="Dispensar mensagem"
            >
              ×
            </button>
          </div>
        )}
        {!app.local && (
          <div className="login-banner">
            <div>
              <b>
                {app.ready
                  ? "Entre para acessar a operação"
                  : "Carregando sua sessão…"}
              </b>
              <p>
                Use sua conta individual para consultar e registrar os dados.
              </p>
            </div>
            <button onClick={() => setLoginOpen(true)}>
              Entrar com usuário e senha
            </button>
          </div>
        )}
        {app.local && (area === "fpy" ? missingYears.length > 0 : !app.local.years[app.year]) && (
          <div className="notice">
            {app.busy ? "Carregando os dados do período…" : `O histórico de ${area === "fpy" ? missingYears.join(", ") : app.year} ainda não está disponível neste dispositivo. Conecte-se e sincronize para consultar o período completo.`}
          </div>
        )}
        <Tabs
          value={tab}
          onValueChange={changeTab}
        >
          {(area === "fpy" || area === "management") && <TabsList className="main-tabs">
            {area === "fpy" && <>
              <TabsTrigger value="fpy">Tabela de FPY</TabsTrigger>
              <TabsTrigger value="defects">Defeitos</TabsTrigger>
              <TabsTrigger value="production">Produção</TabsTrigger>
            </>}
            {area === "management" && <>
              {app.local && (app.local.user.owner === 1 || canCorrect(app.local.user.role)) && <TabsTrigger value="catalog" onClick={() => setManagementTab("catalog")}>Cadastros</TabsTrigger>}
              <TabsTrigger value="sync" onClick={() => setManagementTab("sync")}>Sincronização</TabsTrigger>
              {app.local && (app.local.user.owner === 1 || ["supervisor", "lider", "tecnica"].includes(app.local.user.role)) && (
                <TabsTrigger value="admin" onClick={() => setManagementTab("admin")}>Usuários e backup</TabsTrigger>
              )}
            </>}
          </TabsList>}
          {area === "fpy" && (
            <FpyFilters
              period={period}
              years={availableYears}
              range={range}
              shift={shift}
              line={selectedLine}
              lines={lines}
              search={search}
              defects={tab === "defects"}
              count={tab === "fpy" ? groups.length : entries.filter((entry) => entry.kind === (tab === "defects" ? "defect" : "production")).length}
              unavailable={!app.local || missingYears.length > 0}
              error={rangeError}
              onPeriod={changePeriod}
              onRange={(value) => changePeriod("custom", value)}
              onShift={(value) => { setShift(value); setLimit(100); }}
              onLine={(value) => { setLine(value); setLimit(100); }}
              onSearch={(value) => { setSearch(value); setLimit(100); }}
              onReset={() => {
                setSearch("");
                setShift("all");
                changePeriod(`year:${today.slice(0, 4)}`);
              }}
              onExport={exportSelectedTable}
            />
          )}
          {area === "dashboard" && (
            <AnalyticsDashboard
              entries={app.entries}
              year={app.year}
              onYearChange={(value) => {
                app.setYear(value);
                void app.sync();
              }}
            />
          )}
          <TabsContent value="fpy" hidden={area !== "fpy"}>
            <section className="panel">
              <div className="panel-head">
                <h2>Rendimento por turno</h2>
                <span>
                  {groups.length} combinações
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Data / Semana",
                      "Turno",
                      "Linha",
                      "PN / Modelo",
                      "Produção",
                      "Defeitos",
                      "FPY",
                    ].map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.slice(0, limit).map((g) => (
                    <TableRow key={g.key}>
                      <TableCell>
                        {g.date.split("-").reverse().join("/")}
                        <small className="cell-sub">
                          S{isoWeek(g.date).week} / {isoWeek(g.date).year}
                        </small>
                      </TableCell>
                      <TableCell>{g.shift}º</TableCell>
                      <TableCell>{g.line}</TableCell>
                      <TableCell>
                        <b>{g.pn}</b>
                        <small className="cell-sub">{g.model}</small>
                      </TableCell>
                      <TableCell>
                        {g.production === null
                          ? "Aguardando produção"
                          : number(g.production)}
                      </TableCell>
                      <TableCell>{number(g.defects)}</TableCell>
                      <TableCell>
                        <span className={"badge " + (g.issue ? "warning" : "")}>
                          {g.issue ? "Verificar quantidades" : percent(g.fpy)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!groups.length &&
                empty(
                  missingYears.length && app.local ? "Histórico indisponível" : "Nenhum resultado para estes filtros",
                  missingYears.length && app.local ? "Sincronize para consultar o período completo." : "Ajuste o período, turno, linha ou busca para consultar seus lançamentos.",
                )}
              {groups.length > limit && (
                <button
                  className="secondary more"
                  onClick={() => setLimit(limit + 100)}
                >
                  Mostrar mais 100 registros
                </button>
              )}
            </section>
            {pareto.length > 0 && (
              <section className="panel pareto">
                <h2>Principais defeitos no período</h2>
                {pareto.map(([code, q]) => (
                  <div className="bar-row" key={code}>
                    <b>{code}</b>
                    <div>
                      <span
                        style={{
                          width: Math.max(1, (q / pareto[0][1]) * 100) + "%",
                        }}
                      />
                    </div>
                    <span>{number(q)}</span>
                  </div>
                ))}
              </section>
            )}
          </TabsContent>
          <TabsContent value="defects" hidden={area !== "fpy"}>
            <section className="panel">
              <div className="panel-head">
                <h2>Lançamentos de defeitos</h2>
                <span>Registros individuais · primeira passagem</span>
              </div>
              {recordTable("defect")}
            </section>
          </TabsContent>
          <TabsContent value="production" hidden={area !== "fpy"}>
            <section className="panel">
              <div className="panel-head">
                <h2>Totais de produção</h2>
                <span>Um registro por data, turno, linha e PN</span>
              </div>
              {recordTable("production")}
            </section>
          </TabsContent>
          <TabsContent value="action-plans" hidden={area !== "action-plans"}>
            {app.local && <ActionPlanWorkspace
              entries={app.entries}
              user={app.local.user}
              year={app.year}
              online={app.online}
              onYearChange={(value) => {
                app.setYear(value);
                void app.sync();
              }}
            />}
          </TabsContent>
          <TabsContent value="sync" hidden={area !== "management"}>
            <section className="panel sync-panel">
              <div className="panel-head">
                <h2>Sincronização e consulta offline</h2>
                <button disabled={!app.online || app.busy} onClick={app.sync}>
                  <RefreshCw size={17} className={app.busy ? "spin" : ""} />
                  {app.busy ? "Sincronizando…" : "Sincronizar agora"}
                </button>
              </div>
              <div className="panel-body">
                <p>
                  O ano selecionado é baixado com todos os modelos. A
                  sincronização ocorre ao conectar, ao abrir e a cada dois
                  minutos enquanto o aplicativo está aberto.
                </p>
                <p>
                  Os lançamentos pendentes ficam neste dispositivo até o envio.
                  Não limpe os dados do navegador antes de sincronizar.
                </p>
                {Object.entries(app.local?.years || {}).map(([y, data]) => (
                  <div className="sync-row" key={y}>
                    <Database size={18} />
                    <b>{y}</b>
                    <span>
                      {number(data.records.length)} registros disponíveis
                      offline
                    </span>
                  </div>
                ))}
                {app.local?.pending.map((p) => (
                  <div className="pending-row" key={p.mutation.id}>
                    <b>
                      {p.mutation.entry.pn} ·{" "}
                      {p.mutation.entry.kind === "defect"
                        ? "Defeito " + p.mutation.entry.code
                        : "Produção"}{" "}
                      · {p.mutation.entry.quantity} peças
                    </b>
                    <p>{p.error || "Aguardando envio"}</p>
                    {p.error && (
                      <button
                        className="secondary"
                        onClick={() => setDiscardId(p.mutation.id)}
                      >
                        Descartar envio recusado
                      </button>
                    )}
                  </div>
                ))}
                {!app.local?.pending.length && (
                  <p className="success">Nenhum lançamento pendente.</p>
                )}
                <h3>Instalar no celular</h3>
                <p>
                  No Android, use “Instalar aplicativo” no menu do navegador. No
                  iPhone, abra no Safari e use Compartilhar → Adicionar à Tela
                  de Início. Faça o primeiro acesso e a sincronização com
                  internet.
                </p>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="catalog" hidden={area !== "management"}>
            {app.local && (app.local.user.owner === 1 || canCorrect(app.local.user.role)) && <CatalogManagement items={app.local.catalog} online={app.online} onUpdated={app.sync} />}
          </TabsContent>
          <TabsContent value="admin" hidden={area !== "management"}>
            {app.local && (
              <UserManagement
                actor={app.local.user}
                online={app.online}
                onUpdated={() => void app.sync()}
              />
            )}
            {app.local?.user.owner === 1 && app.local.user.backupAvailable && (
              <section className="panel backup-panel">
                <div className="panel-head">
                  <h2>Backup · retenção de 12 meses</h2>
                  <button
                    disabled={adminBusy || !app.online}
                    onClick={() =>
                      admin(async () => {
                        const r = await fetchJson<{ date: string }>("/api/backups", {
                          method: "POST",
                        });
                        setBackup(r.date);
                      })
                    }
                  >
                    Criar backup agora
                  </button>
                </div>
                <div className="panel-body">
                  <p>
                    O backup manual está disponível. O agendamento diário ainda
                    precisa ser configurado no ambiente de hospedagem.
                  </p>
                  {backup && (
                    <p role="status">
                      Backup de {backup} disponível.{" "}
                      <a
                        className="text-button"
                        href={"/api/backups?date=" + backup}
                        download
                      >
                        Baixar cópia
                      </a>
                    </p>
                  )}
                  <p>
                    Os dados do sistema não são apagados ao completar um ano.
                  </p>
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
        <p className="footnote">
          FPY = (produção − defeitos) ÷ produção × 100. Semana ISO: segunda a
          domingo. Resultados incluem lançamentos locais pendentes e mudam
          conforme novos registros são informados.
        </p>
      </section>
      {loginOpen && (
        <Login
          onClose={() => setLoginOpen(false)}
          onSuccess={() => void app.sync()}
        />
      )}
      {profileOpen && app.local && (
        <UserEditor
          actor={app.local.user}
          target={app.local.user}
          onClose={() => setProfileOpen(false)}
          onSaved={() => void app.sync()}
          onPassword={() => {
            setProfileOpen(false);
            setPasswordOpen(true);
          }}
        />
      )}
      {(passwordOpen || app.local?.user.mustChange) && app.local && (
        <PasswordEditor
          user={app.local.user}
          onClose={() => setPasswordOpen(false)}
          onSaved={() => void app.sync()}
        />
      )}
      {form && app.local && (
        <EntryForm
          key={form.entry?.id || form.kind}
          kind={form.kind}
          editing={form.entry}
          user={app.local.user}
          entries={app.entries}
          catalog={app.local.catalog}
          onClose={() => setForm(null)}
          onSave={app.save}
        />
      )}
      <Dialog
        open={history !== null}
        onOpenChange={(o) => {
          if (!o) setHistory(null);
        }}
      >
        <DialogContent className="history-dialog">
          <DialogHeader>
            <DialogTitle>Histórico de correções</DialogTitle>
            <DialogDescription>
              Últimas 100 alterações deste registro.
            </DialogDescription>
          </DialogHeader>
          {history?.length ? (
            history.map((h) => (
              <div className="history-item" key={h.id}>
                <b>
                  {h.actor} · {new Date(h.at).toLocaleString("pt-BR")}
                </b>
                <p>{h.reason}</p>
                {Object.entries(JSON.parse(h.after))
                  .filter(([k, v]) => JSON.parse(h.before)[k] !== v)
                  .map(([k, v]) => (
                    <p key={k}>
                      <strong>
                        {(
                          {
                            quantity: "Quantidade",
                            date: "Data",
                            shift: "Turno",
                            line: "Linha",
                            pn: "PN",
                            model: "Modelo",
                            code: "Código",
                            description: "Descrição",
                            position: "Posição",
                            station: "Estação",
                            category: "Interno / categoria original",
                            classCc: "Class. CC",
                            revision: "Revisão",
                          } as Record<string, string>
                        )[k] || k}
                        :
                      </strong>{" "}
                      {String(JSON.parse(h.before)[k])} → {String(v)}
                    </p>
                  ))}
              </div>
            ))
          ) : (
            <p>Nenhuma correção registrada.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!discardId}
        onOpenChange={(o) => {
          if (!o) setDiscardId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar envio recusado?</DialogTitle>
            <DialogDescription>
              O lançamento local será removido. Um registro já existente no
              servidor não será alterado. Você poderá lançar novamente com os
              dados corretos.
            </DialogDescription>
          </DialogHeader>
          <button
            onClick={async () => {
              try {
                await app.discard(discardId!);
                setDiscardId(null);
              } catch (e) {
                app.setMessage((e as Error).message);
              }
            }}
          >
            Confirmar descarte
          </button>
          <button className="secondary" onClick={() => setDiscardId(null)}>
            Voltar
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
