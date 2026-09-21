"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/src/frontend/infrastructure/offline";
import type { CatalogItem } from "@/src/shared/domain/catalog";
import type { User } from "@/src/shared/domain/fpy";
import type { ActionPlan, ActionPlanStatus } from "@/src/shared/domain/pqc";

const statusLabel: Record<ActionPlanStatus, string> = { aberto: "Aberto", em_analise: "Em análise", concluido: "Concluído" };
const today = () => new Date().toISOString().slice(0, 10);

function blankPlan(): ActionPlan {
  return { id: crypto.randomUUID(), date: today(), shift: "1", line: "", pn: "", model: "", quantity: 1, defectCode: "", defectDescription: "", category: "", position: "", evidence: "", containment: "", rootCause: "", correctiveAction: "", verification: "", responsible: "", dueDate: "", status: "aberto", openedBy: "", createdAt: "", updatedAt: "", revision: 0 };
}

export default function ActionPlanManagement({ user, catalog, online }: { user: User; catalog?: CatalogItem[]; online: boolean }) {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [status, setStatus] = useState("ativos");
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<ActionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canOpen = !!user.owner || ["tecnica", "supervisor", "lider"].includes(user.role);
  const canDevelop = !!user.owner || ["engenharia", "supervisor", "lider", "tecnica"].includes(user.role);
  const products = (catalog || []).filter((item) => item.kind === "product" && item.active === 1);
  const defects = (catalog || []).filter((item) => item.kind === "defect" && item.active === 1);

  const load = useCallback(async () => {
    if (!online) return;
    setBusy(true);
    try { setPlans(await fetchJson<ActionPlan[]>("/api/action-plans")); setMessage(""); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }, [online]);
  useEffect(() => {
    if (!online) return;
    let active = true;
    fetchJson<ActionPlan[]>("/api/action-plans")
      .then((data) => { if (active) { setPlans(data); setMessage(""); } })
      .catch((error) => { if (active) setMessage((error as Error).message); });
    return () => { active = false; };
  }, [online]);

  const filtered = useMemo(() => plans.filter((plan) => {
    if (status === "ativos" && plan.status === "concluido") return false;
    if (status !== "todos" && status !== "ativos" && plan.status !== status) return false;
    return [plan.pn,plan.model,plan.defectCode,plan.defectDescription,plan.category,plan.line,plan.responsible].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  }), [plans, search, status]);
  const counts = { open: plans.filter((p) => p.status === "aberto").length, analysis: plans.filter((p) => p.status === "em_analise").length, done: plans.filter((p) => p.status === "concluido").length };

  function change<K extends keyof ActionPlan>(key: K, value: ActionPlan[K]) { setEdit((current) => current ? { ...current, [key]: value } : current); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!edit) return;
    setBusy(true); setMessage("");
    try {
      await fetchJson("/api/action-plans", { method: "POST", body: JSON.stringify(edit) });
      setEdit(null); await load(); setMessage(edit.revision ? "Plano de ação atualizado." : "PQC aberto e encaminhado para análise.");
    } catch (e) { setMessage((e as Error).message); setBusy(false); }
  }
  function selectProduct(pn: string) {
    const product = products.find((item) => item.code === pn);
    if (product) setEdit((current) => current && ({ ...current, pn: product.code, model: product.label }));
  }
  function selectDefect(id: string) {
    const defect = defects.find((item) => item.id === id);
    if (defect) setEdit((current) => current && ({ ...current, defectCode: defect.code, defectDescription: defect.label, category: defect.category, evidence: current.evidence }));
  }

  return <section className="panel action-plan-panel">
    <div className="panel-head"><div><h2>PQC e planos de ação</h2><span>Qualidade evidencia o defeito; Engenharia analisa e conclui o plano</span></div><div className="panel-actions"><button className="secondary" disabled={!online || busy} onClick={() => void load()}><RefreshCw size={16} className={busy ? "spin" : ""} /> Atualizar</button>{canOpen && <button disabled={!online || !catalog} onClick={() => setEdit(blankPlan())}><Plus size={17} /> Novo PQC</button>}</div></div>
    <div className="panel-body">
      <div className="action-plan-metrics"><article><span>Abertos</span><strong>{counts.open}</strong></article><article><span>Em análise</span><strong>{counts.analysis}</strong></article><article><span>Concluídos</span><strong>{counts.done}</strong></article></div>
      <div className="catalog-controls"><label>Situação<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ativos">Pendentes</option><option value="aberto">Abertos</option><option value="em_analise">Em análise</option><option value="concluido">Concluídos</option><option value="todos">Todos</option></select></label><label>Buscar<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="PN, modelo, defeito, categoria ou responsável" /></label></div>
      {!online && <p className="notice">Os planos de ação exigem conexão para manter o histórico atualizado.</p>}
      {message && <p role="status">{message}</p>}
      <div className="catalog-table"><table><thead><tr><th>Data / Turno</th><th>Produto</th><th>Defeito</th><th>Categoria</th><th>Situação</th><th>Responsável</th><th>Ação</th></tr></thead><tbody>{filtered.map((plan) => <tr key={plan.id}><td>{plan.date.split("-").reverse().join("/")}<small className="cell-sub">{plan.shift}º turno · {plan.line}</small></td><td><b>{plan.pn}</b><small className="cell-sub">{plan.model}</small></td><td><b>{plan.defectCode}</b><small className="cell-sub">{plan.defectDescription} · {plan.quantity} peça(s)</small></td><td>{plan.category}</td><td><span className={`plan-status ${plan.status}`}>{statusLabel[plan.status]}</span></td><td>{plan.responsible || "A definir"}</td><td><button className="secondary" disabled={!online} onClick={() => setEdit({ ...plan })}>{canDevelop ? "Abrir plano" : "Consultar"}</button></td></tr>)}{!filtered.length && <tr><td colSpan={7}>Nenhum plano encontrado.</td></tr>}</tbody></table></div>
    </div>
    {edit && <Dialog open onOpenChange={(open) => { if (!open && !busy) setEdit(null); }}><DialogContent className="entry-dialog action-plan-dialog"><DialogHeader><DialogTitle>{edit.revision ? `PQC · ${edit.defectCode}` : "Abrir novo PQC"}</DialogTitle><DialogDescription>{edit.revision ? "Complete a análise da Engenharia e registre a verificação antes de concluir." : "Registre a identificação e a evidência inicial do defeito encontrada pela Qualidade."}</DialogDescription></DialogHeader><form onSubmit={save}>
      {edit.revision === 0 ? <div className="form-grid">
        <label>Data<input required type="date" value={edit.date} onChange={(e) => change("date",e.target.value)} /></label><label>Turno<select value={edit.shift} onChange={(e) => change("shift",e.target.value)}><option value="1">1º turno</option><option value="2">2º turno</option><option value="3">3º turno</option></select></label><label>Linha<input required maxLength={160} value={edit.line} onChange={(e) => change("line",e.target.value)} /></label>
        <label>PN<select required value={edit.pn} onChange={(e) => selectProduct(e.target.value)}><option value="">Selecione</option>{products.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.label}</option>)}</select></label><label>Modelo<input readOnly value={edit.model} /></label>
        <label>Defeito<select required value={defects.find((item) => item.code === edit.defectCode && item.label === edit.defectDescription)?.id || ""} onChange={(e) => selectDefect(e.target.value)}><option value="">Selecione</option>{defects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.label} · {item.category}</option>)}</select></label><label>Categoria<input readOnly value={edit.category} /></label><label>Quantidade<input required min={1} type="number" value={edit.quantity} onChange={(e) => change("quantity",Number(e.target.value))} /></label><label>Posição mecânica<input maxLength={160} value={edit.position} onChange={(e) => change("position",e.target.value)} /></label><label className="full-field">Evidência / descrição inicial<textarea required maxLength={4000} rows={4} value={edit.evidence} onChange={(e) => change("evidence",e.target.value)} placeholder="Descreva o defeito observado, local e condição encontrada." /></label>
      </div> : <><div className="action-plan-context"><div><span>Produto</span><b>{edit.pn} · {edit.model}</b></div><div><span>Defeito</span><b>{edit.defectCode} · {edit.defectDescription}</b></div><div><span>Ocorrência</span><b>{edit.date.split("-").reverse().join("/")} · {edit.shift}º turno · {edit.line}</b></div><div><span>Qualidade</span><b>{edit.openedByName || "Usuário cadastrado"}</b></div><div className="context-wide"><span>Evidência inicial</span><p>{edit.evidence}</p></div></div><div className="form-grid">
        <label className="full-field">Contenção imediata<textarea rows={3} maxLength={4000} readOnly={!canDevelop} value={edit.containment} onChange={(e) => change("containment",e.target.value)} /></label><label className="full-field">Causa raiz<textarea rows={3} maxLength={4000} readOnly={!canDevelop} value={edit.rootCause} onChange={(e) => change("rootCause",e.target.value)} /></label><label className="full-field">Ação corretiva<textarea rows={3} maxLength={4000} readOnly={!canDevelop} value={edit.correctiveAction} onChange={(e) => change("correctiveAction",e.target.value)} /></label><label>Responsável<input maxLength={160} readOnly={!canDevelop} value={edit.responsible} onChange={(e) => change("responsible",e.target.value)} /></label><label>Prazo<input type="date" readOnly={!canDevelop} value={edit.dueDate} onChange={(e) => change("dueDate",e.target.value)} /></label><label className="full-field">Verificação da eficácia<textarea rows={3} maxLength={4000} readOnly={!canDevelop} value={edit.verification} onChange={(e) => change("verification",e.target.value)} /></label><label>Situação<select disabled={!canDevelop} value={edit.status} onChange={(e) => change("status",e.target.value as ActionPlanStatus)}><option value="aberto">Aberto</option><option value="em_analise">Em análise</option><option value="concluido">Concluído</option></select></label>
      </div></>}
      <div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={() => setEdit(null)}>Fechar</button>{(edit.revision === 0 ? canOpen : canDevelop) && <button disabled={busy || !online}><ClipboardCheck size={17} /> {busy ? "Salvando…" : edit.revision ? "Salvar plano" : "Abrir PQC"}</button>}</div>
    </form></DialogContent></Dialog>}
  </section>;
}
