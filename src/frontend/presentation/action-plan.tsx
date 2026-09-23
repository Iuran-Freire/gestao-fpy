"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Eye, RefreshCw, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/frontend/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/frontend/components/ui/table";
import { fetchJson } from "@/src/frontend/infrastructure/offline";
import { canStartActionPlan, canTreatActionPlan, type ActionPlan, type ActionPlanStatus } from "@/src/shared/domain/action-plan";
import type { Entry, User } from "@/src/shared/domain/fpy";

type DialogMode = "quality" | "engineering" | "view";
type Selection = { entry: Entry; plan?: ActionPlan; mode: DialogMode };

const emptyPlan = (recordId: string): ActionPlan => ({
  id: crypto.randomUUID(), recordId, evidence: "", containment: "", rootCause: "",
  correctiveAction: "", responsible: "", dueDate: "", status: "open",
  qualityBy: "", qualityAt: "", engineeringBy: "", engineeringAt: "", updatedAt: "", revision: 0,
});
const statusLabel: Record<ActionPlanStatus, string> = { open: "Aguardando Engenharia", in_progress: "Em andamento", completed: "Concluído" };
const displayDate = (value: string) => value.split("-").reverse().join("/");

function PlanTable({ rows, plans, action }: { rows: Entry[]; plans: Map<string, ActionPlan>; action: (entry: Entry, plan?: ActionPlan) => React.ReactNode }) {
  return <>
    <Table>
      <TableHeader><TableRow>{["Data / turno", "Linha", "PN / Modelo", "Defeito", "Status", "Ação"].map((title) => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.slice(0, 100).map((entry) => {
        const plan = plans.get(entry.id);
        return <TableRow key={entry.id}>
          <TableCell>{displayDate(entry.date)}<small className="cell-sub">{entry.shift}º turno</small></TableCell>
          <TableCell>{entry.line}</TableCell>
          <TableCell><b>{entry.pn}</b><small className="cell-sub">{entry.model}</small></TableCell>
          <TableCell><b>{entry.code}</b><small className="cell-sub">{entry.description}</small></TableCell>
          <TableCell>{plan ? <span className={`badge plan-${plan.status}`}>{statusLabel[plan.status]}</span> : <span className="badge">Sem plano</span>}</TableCell>
          <TableCell>{action(entry, plan)}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
    {!rows.length && <div className="plan-empty"><ClipboardCheck size={30} /><b>Nenhum registro nesta etapa</b><span>Os registros aparecem aqui conforme avançam no fluxo.</span></div>}
    {rows.length > 100 && <p className="plan-result-limit">Mostrando os 100 registros mais recentes. Use os filtros acima para localizar outros registros.</p>}
  </>;
}

export function ActionPlanWorkspace({ entries, user, year, online, onYearChange }: {
  entries: Entry[];
  user: User;
  year: string;
  online: boolean;
  onYearChange: (year: string) => void;
}) {
  const [tab, setTab] = useState<"new" | "open" | "completed">("new");
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [category, setCategory] = useState("all");
  const [line, setLine] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [defectSearch, setDefectSearch] = useState("");
  const [responsibleSearch, setResponsibleSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deadline, setDeadline] = useState<"all" | "overdue" | "next7" | "without">("all");
  const load = useCallback(async () => {
    if (!online) return;
    setLoading(true); setError("");
    try { setPlans(await fetchJson<ActionPlan[]>(`/api/action-plans?year=${encodeURIComponent(year)}`)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, [online, year]);
  useEffect(() => {
    if (!online) return;
    let active = true;
    void fetchJson<ActionPlan[]>(`/api/action-plans?year=${encodeURIComponent(year)}`)
      .then((value) => { if (active) setPlans(value); })
      .catch((reason) => { if (active) setError((reason as Error).message); });
    return () => { active = false; };
  }, [online, year]);
  const byRecord = useMemo(() => new Map(plans.map((plan) => [plan.recordId, plan])), [plans]);
  const availableDefects = entries.filter((entry) => entry.kind === "defect");
  const categories = [...new Set(availableDefects.map((entry) => entry.category).filter(Boolean))].sort();
  const lines = [...new Set(availableDefects.map((entry) => entry.line).filter(Boolean))].sort();
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(`${today}T12:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const nextWeekIso = nextWeek.toISOString().slice(0, 10);
  const normalizedProduct = productSearch.trim().toLocaleLowerCase("pt-BR");
  const normalizedDefect = defectSearch.trim().toLocaleLowerCase("pt-BR");
  const normalizedResponsible = responsibleSearch.trim().toLocaleLowerCase("pt-BR");
  const defects = entries
    .filter((entry) => entry.kind === "defect")
    .filter((entry) => category === "all" || entry.category === category)
    .filter((entry) => line === "all" || entry.line === line)
    .filter((entry) => !from || entry.date >= from)
    .filter((entry) => !to || entry.date <= to)
    .filter((entry) => !normalizedProduct || `${entry.pn} ${entry.model}`.toLocaleLowerCase("pt-BR").includes(normalizedProduct))
    .filter((entry) => !normalizedDefect || `${entry.code} ${entry.description} ${entry.position}`.toLocaleLowerCase("pt-BR").includes(normalizedDefect))
    .filter((entry) => {
      const plan = byRecord.get(entry.id);
      if (normalizedResponsible && !plan?.responsible.toLocaleLowerCase("pt-BR").includes(normalizedResponsible)) return false;
      if (deadline === "overdue") return !!plan?.dueDate && plan.dueDate < today && plan.status !== "completed";
      if (deadline === "next7") return !!plan?.dueDate && plan.dueDate >= today && plan.dueDate <= nextWeekIso && plan.status !== "completed";
      if (deadline === "without") return !plan?.dueDate;
      return true;
    })
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt));
  const newRows = defects.filter((entry) => !byRecord.has(entry.id));
  const openRows = defects.filter((entry) => { const plan = byRecord.get(entry.id); return plan && plan.status !== "completed"; });
  const completedRows = defects.filter((entry) => byRecord.get(entry.id)?.status === "completed");
  const startAllowed = canStartActionPlan(user);
  const treatAllowed = canTreatActionPlan(user);
  function clearFilters() {
    setCategory("all");
    setLine("all");
    setProductSearch("");
    setDefectSearch("");
    setResponsibleSearch("");
    setFrom("");
    setTo("");
    setDeadline("all");
  }
  return <>
    <div className="panel plan-filters">
      <label>Ano<select value={year} onChange={(event) => onYearChange(event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(new Date().getFullYear() - index)).map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Linha<select value={line} onChange={(event) => setLine(event.target.value)}><option value="all">Todas</option>{lines.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Situação do prazo<select value={deadline} onChange={(event) => setDeadline(event.target.value as typeof deadline)}><option value="all">Todos</option><option value="overdue">Atrasados</option><option value="next7">Vencem em 7 dias</option><option value="without">Sem prazo definido</option></select></label>
      <label>Ocorrência de<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>Ocorrência até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label className="plan-search">PN ou modelo<input placeholder="Pesquisar produto…" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label>
      <label className="plan-search">Código, defeito ou posição<input placeholder="Pesquisar defeito…" value={defectSearch} onChange={(event) => setDefectSearch(event.target.value)} /></label>
      <label className="plan-responsible">Responsável<input placeholder="Nome do responsável…" value={responsibleSearch} onChange={(event) => setResponsibleSearch(event.target.value)} /></label>
      <button className="text-button clear-plan-filters" onClick={clearFilters}>Limpar filtros</button>
    </div>
    <section className="panel action-plan-workspace">
    <div className="plan-tabs" role="tablist" aria-label="Etapas do plano de ação">
      <button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>Iniciar registro <i>{newRows.length}</i></button>
      <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Planos abertos <i>{openRows.length}</i></button>
      <button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Concluídos <i>{completedRows.length}</i></button>
      <button className="refresh-plans" title="Atualizar planos" disabled={!online || loading} onClick={() => void load()}><RefreshCw size={16} className={loading ? "spin" : ""} /> Atualizar</button>
    </div>
    <div className="plan-stage-head"><div>
      <h2>{tab === "new" ? "Registro inicial da Qualidade" : tab === "open" ? "Planos de ação abertos" : "Planos concluídos"}</h2>
      <span>{tab === "new" ? "A Qualidade registra a evidência e envia a ocorrência para a Engenharia." : tab === "open" ? "A Engenharia analisa, registra as ações e fecha o plano." : "Histórico dos planos finalizados pela Engenharia."}</span>
    </div></div>
    {error && <p className="error plan-message" role="alert">{error}</p>}
    {!online && <p className="notice plan-message">Os planos de ação precisam de conexão com o servidor.</p>}
    {tab === "new" && !startAllowed && <p className="notice plan-message">Seu perfil pode consultar os planos, mas somente a Qualidade pode iniciar um registro.</p>}
    {tab === "open" && !treatAllowed && <p className="notice plan-message">Seu perfil pode consultar os planos abertos, mas somente a Engenharia pode tratá-los e fechá-los.</p>}
    {tab === "new" && <PlanTable rows={newRows} plans={byRecord} action={(entry) => <button disabled={!online || !startAllowed} onClick={() => setSelection({ entry, mode: "quality" })}><ClipboardCheck size={16} /> Iniciar plano</button>} />}
    {tab === "open" && <PlanTable rows={openRows} plans={byRecord} action={(entry, plan) => <button className={treatAllowed ? "" : "secondary"} disabled={!online} onClick={() => setSelection({ entry, plan, mode: treatAllowed ? "engineering" : "view" })}>{treatAllowed ? <Wrench size={16} /> : <Eye size={16} />}{treatAllowed ? "Tratar plano" : "Visualizar"}</button>} />}
    {tab === "completed" && <PlanTable rows={completedRows} plans={byRecord} action={(entry, plan) => <button className="secondary" onClick={() => setSelection({ entry, plan, mode: "view" })}><Eye size={16} /> Visualizar</button>} />}
    {selection && <ActionPlanDialog {...selection} onClose={() => setSelection(null)} onSaved={async (saved) => { setSelection(null); await load(); setTab(saved.status === "completed" ? "completed" : "open"); }} />}
    </section>
  </>;
}

export default function ActionPlanDialog({ entry, plan: initialPlan, mode, onClose, onSaved }: { entry: Entry; plan?: ActionPlan; mode: DialogMode; onClose: () => void; onSaved: (plan: ActionPlan) => void }) {
  const [plan, setPlan] = useState<ActionPlan>(() => initialPlan || emptyPlan(entry.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readonly = mode === "view";
  function field<K extends keyof ActionPlan>(key: K, value: ActionPlan[K]) { setPlan((current) => ({ ...current, [key]: value })); }
  async function save(status: ActionPlanStatus) {
    setError(""); setSaving(true);
    try { onSaved(await fetchJson<ActionPlan>("/api/action-plans", { method: "POST", body: JSON.stringify({ ...plan, status }) })); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="entry-dialog action-plan-dialog">
      <DialogHeader>
        <DialogTitle>{mode === "quality" ? "Iniciar Plano de Ação" : mode === "engineering" ? "Tratar Plano de Ação" : "Plano de Ação concluído"}</DialogTitle>
        <DialogDescription>{mode === "quality" ? "Registre a evidência inicial. Depois do envio, o plano ficará disponível para a Engenharia." : mode === "engineering" ? "Consulte a evidência da Qualidade, registre a análise e conclua a ação." : "Consulta do registro completo da Qualidade e da Engenharia."}</DialogDescription>
      </DialogHeader>
      <div className="action-plan-context" aria-label="Dados do defeito vinculado">
        <div><span>Ocorrência</span><b>{displayDate(entry.date)} · {entry.shift}º turno · {entry.line}</b></div>
        <div><span>Produto</span><b>{entry.pn} · {entry.model}</b><small>{entry.category || "Sem categoria"}</small></div>
        <div><span>Defeito</span><b>{entry.code} · {entry.description}</b><small>Posição {entry.position} · Quantidade {entry.quantity}</small></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (mode === "quality") void save("open"); else if (mode === "engineering") void save("in_progress"); }}>
        <section className="form-section">
          <h3>Registro da Qualidade</h3>
          <label>Evidência inicial<textarea required maxLength={4000} rows={4} readOnly={mode !== "quality"} value={plan.evidence} onChange={(e) => field("evidence", e.target.value)} placeholder="Descreva o defeito observado, o local e a condição encontrada." /></label>
          {plan.qualityBy && <p className="form-hint">Registrado por {plan.qualityBy} em {new Date(plan.qualityAt).toLocaleString("pt-BR")}.</p>}
        </section>
        {mode !== "quality" && <section className="form-section">
          <h3>Análise e ação da Engenharia</h3>
          <div className="form-grid">
            <label>Contenção imediata<textarea maxLength={4000} rows={3} readOnly={readonly} value={plan.containment} onChange={(e) => field("containment", e.target.value)} /></label>
            <label>Causa raiz<textarea maxLength={4000} rows={3} readOnly={readonly} value={plan.rootCause} onChange={(e) => field("rootCause", e.target.value)} /></label>
            <label className="full-field">Ação corretiva<textarea maxLength={4000} rows={3} readOnly={readonly} value={plan.correctiveAction} onChange={(e) => field("correctiveAction", e.target.value)} /></label>
            <label>Responsável<input maxLength={160} readOnly={readonly} value={plan.responsible} onChange={(e) => field("responsible", e.target.value)} /></label>
            <label>Prazo<input type="date" readOnly={readonly} value={plan.dueDate} onChange={(e) => field("dueDate", e.target.value)} /></label>
          </div>
          {plan.engineeringBy && <p className="form-hint">Última atualização da Engenharia por {plan.engineeringBy} em {new Date(plan.engineeringAt).toLocaleString("pt-BR")}.</p>}
        </section>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-footer">
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>{readonly ? "Fechar" : "Cancelar"}</button>
          {mode === "quality" && <button disabled={saving}>{saving ? "Enviando…" : "Enviar para Engenharia"}</button>}
          {mode === "engineering" && <><button className="secondary" disabled={saving}>{saving ? "Salvando…" : "Salvar andamento"}</button><button type="button" disabled={saving} onClick={() => void save("completed")}>Fechar plano</button></>}
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
