"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  Plus,
  Factory,
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  Pencil,
  History,
  Download,
  ShieldCheck,
  Database,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { useFpy } from "@/src/application/use-fpy";
import {
  summarize,
  totalFpy,
  isoWeek,
  canCorrect,
  type Entry,
  type User,
} from "@/src/domain/fpy";
import { fetchJson } from "@/src/infrastructure/offline";
import { Choice, EntryForm } from "./entry-form";
import UserManagement, { UserEditor, PasswordEditor } from "./user-management";
import Login from "./login";
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
};
export default function Dashboard() {
  const app = useFpy();
  const [loginOpen, setLoginOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false);
  const [tab, setTab] = useState("fpy"),
    [form, setForm] = useState<{
      kind: "production" | "defect";
      entry?: Entry;
    } | null>(null),
    [search, setSearch] = useState(""),
    [shift, setShift] = useState("all"),
    [line, setLine] = useState("all"),
    [week, setWeek] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [limit, setLimit] = useState(100),
    [users, setUsers] = useState<User[]>([]),
    [history, setHistory] = useState<unknown[] | null>(null),
    [install, setInstall] = useState<any>(null),
    [backup, setBackup] = useState(""),
    [adminBusy, setAdminBusy] = useState(false),
    [discardId, setDiscardId] = useState<string | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (registration) => {
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
          app.setMessage(
            "Não foi possível ativar a abertura offline. Tente recarregar.",
          ),
        );
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    return () => window.removeEventListener("beforeinstallprompt", prompt);
  }, []);
  const entries = app.entries.filter(
    (e) =>
      (!search ||
        `${e.pn} ${e.model} ${e.code} ${e.position}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (shift === "all" || e.shift === shift) &&
      (line === "all" || e.line === line) &&
      (!week || isoWeek(e.date).week === Number(week)) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to),
  );
  // FPY uses context filters only: code/position searching must never remove some defects from its denominator.
  const contexts = app.entries.filter(
    (e) =>
      (!search ||
        `${e.pn} ${e.model}`.toLowerCase().includes(search.toLowerCase())) &&
      (shift === "all" || e.shift === shift) &&
      (line === "all" || e.line === line) &&
      (!week || isoWeek(e.date).week === Number(week)) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to),
  );
  const groups = summarize(contexts),
    production = groups.reduce((s, g) => s + (g.production || 0), 0),
    defects = groups.reduce((s, g) => s + g.defects, 0),
    fpy = totalFpy(groups),
    pendingIds = new Set(app.local?.pending.map((p) => p.mutation.entry.id));
  const lines = [...new Set(app.entries.map((e) => e.line))].sort(),
    canEdit = app.local && canCorrect(app.local.user.role);
  async function showHistory(e: Entry) {
    try {
      setHistory(await fetchJson("/api/history?id=" + e.id));
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
  return (
    <main className="workspace">
      <header className="topbar">
        <img
          src="/inventus-power-logo.svg"
          alt="Inventus Power"
          width="166"
          height="48"
        />
        <span className="system-name">
          QUALIDADE <b>Gestão de FPY</b>
        </span>
      </header>
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
                    disabled={!app.online || !app.local.user.username}
                    onClick={() => setPasswordOpen(true)}
                  >
                    Minha senha
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setLoginOpen(true)}
                  >
                    Trocar conta
                  </button>
                </div>
                <button
                  className="icon-button"
                  aria-label="Sair da conta"
                  onClick={app.logout}
                >
                  <LogOut size={17} />
                </button>
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
            <h1>Visão da operação</h1>
            <p>Produção e qualidade, do primeiro ao terceiro turno.</p>
          </div>
          <div className="actions">
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
          </div>
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
        {app.local && !app.local.years[app.year] && (
          <div className="notice">
            O ano {app.year} ainda não foi baixado neste dispositivo. Conecte-se
            e sincronize para consultar o histórico completo.
          </div>
        )}
        <div className="metrics">
          <article className="metric highlight">
            <span>FIRST PASS YIELD</span>
            <strong>{percent(fpy)}</strong>
            <p>
              {groups.some((g) => g.issue)
                ? "Verifique defeitos acima da produção"
                : groups.some((g) => g.production === null)
                  ? "Há grupos aguardando produção"
                  : "Aprovação na primeira passagem"}
            </p>
            <Activity className="metric-icon" />
          </article>
          <article className="metric">
            <span>PRODUÇÃO</span>
            <strong>{number(production)}</strong>
            <p>Peças produzidas no período</p>
          </article>
          <article className="metric">
            <span>DEFEITOS</span>
            <strong>{number(defects)}</strong>
            <p>Peças reprovadas de primeira</p>
          </article>
          <article className="metric">
            <span>ENVIO PENDENTE</span>
            <strong>{app.local?.pending.length || 0}</strong>
            <p>Lançamentos neste dispositivo</p>
          </article>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setLimit(100);
          }}
        >
          <TabsList className="main-tabs">
            <TabsTrigger value="fpy">Tabela de FPY</TabsTrigger>
            <TabsTrigger value="defects">Defeitos</TabsTrigger>
            <TabsTrigger value="production">Produção</TabsTrigger>
            <TabsTrigger value="sync">Sincronização</TabsTrigger>
            {app.local && canCorrect(app.local.user.role) && (
              <TabsTrigger value="admin">Gestão</TabsTrigger>
            )}
          </TabsList>
          {["fpy", "defects", "production"].includes(tab) && (
            <div className="filters panel">
              <Choice
                label="Ano"
                value={app.year}
                onChange={(v) => {
                  app.setYear(v);
                  setFrom("");
                  setTo("");
                  setTimeout(() => app.sync(), 0);
                }}
                items={Array.from({ length: 12 }, (_, i) =>
                  String(new Date().getFullYear() - i),
                ).map((v) => ({ value: v, label: v }))}
              />
              <label>
                Semana ISO
                <input
                  type="number"
                  min="1"
                  max="53"
                  placeholder="Todas"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </label>
              <Choice
                label="Turno"
                value={shift}
                onChange={setShift}
                items={[
                  { value: "all", label: "Todos" },
                  ...["1", "2", "3"].map((v) => ({
                    value: v,
                    label: v + "º turno",
                  })),
                ]}
              />
              <Choice
                label="Linha"
                value={line}
                onChange={setLine}
                items={[
                  { value: "all", label: "Todas" },
                  ...lines.map((v) => ({ value: v, label: v })),
                ]}
              />
              <label>
                De
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="search-field">
                {tab === "defects"
                  ? "PN, modelo, código ou posição"
                  : "PN ou modelo"}
                <input
                  placeholder="Pesquisar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setShift("all");
                  setLine("all");
                  setWeek("");
                  setFrom("");
                  setTo("");
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}
          <TabsContent value="fpy">
            <section className="panel">
              <div className="panel-head">
                <h2>Rendimento por turno</h2>
                <span>
                  {groups.length} combinações · {app.year}
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
                  "Pronto para o primeiro lançamento",
                  "Informe produção e registre defeitos para acompanhar o FPY.",
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
          <TabsContent value="defects">
            <section className="panel">
              <div className="panel-head">
                <h2>Lançamentos de defeitos</h2>
                <span>Registros individuais · primeira passagem</span>
              </div>
              {recordTable("defect")}
            </section>
          </TabsContent>
          <TabsContent value="production">
            <section className="panel">
              <div className="panel-head">
                <h2>Totais de produção</h2>
                <span>Um registro por data, turno, linha e PN</span>
              </div>
              {recordTable("production")}
            </section>
          </TabsContent>
          <TabsContent value="sync">
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
          <TabsContent value="admin">
            {app.local && (
              <UserManagement
                actor={app.local.user}
                online={app.online}
                onUpdated={() => void app.sync()}
              />
            )}
            {app.local?.user.owner === 1 && (
              <section className="panel backup-panel">
                <div className="panel-head">
                  <h2>Backup · retenção de 12 meses</h2>
                  <button
                    disabled={adminBusy || !app.online}
                    onClick={() =>
                      admin(async () => {
                        const r = await fetchJson("/api/backups", {
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
            history.map((h: any) => (
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
                            category: "Categoria",
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
