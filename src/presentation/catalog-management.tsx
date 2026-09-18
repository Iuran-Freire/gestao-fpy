"use client";
import { useState } from "react";
import type { CatalogItem } from "@/src/domain/catalog";
import { fetchJson } from "@/src/infrastructure/offline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function CatalogManagement({ items, online, onUpdated }: {
  items?: CatalogItem[]; online: boolean; onUpdated: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"product" | "defect">("product");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [limit, setLimit] = useState(50);
  const [edit, setEdit] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = (items || []).filter(i => i.kind === kind && (showInactive || i.active === 1) &&
    [i.code,i.label,i.internal,i.classCc,i.station,i.sector].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  function change(key: keyof CatalogItem, value: string) { setEdit(e => e && ({ ...e, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!edit) return;
    setBusy(true); setMessage("");
    try {
      await fetchJson("/api/catalog", { method: "POST", body: JSON.stringify(edit) });
      setEdit(null);
      await onUpdated();
      setMessage("Cadastro salvo. Os lançamentos anteriores mantêm seus dados originais.");
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel catalog-panel">
    <div className="panel-head"><div><h2>Base de cadastros</h2><span>Produtos, classificações e defeitos</span></div>
      <button disabled={!online || !items} onClick={() => { setMessage(""); setEdit({ id: crypto.randomUUID(),kind,code:"",label:"",internal:"",classCc:"",station:"",sector:"",active:1,revision:0 }); }}>Novo {kind === "product" ? "produto" : "defeito"}</button></div>
    <div className="panel-body">
      <div className="catalog-controls">
        <label>Cadastro<select value={kind} onChange={e => {setKind(e.target.value as typeof kind);setLimit(50);}}><option value="product">PN / Modelos</option><option value="defect">Códigos de defeito</option></select></label>
        <label>Buscar<input value={search} onChange={e => {setSearch(e.target.value);setLimit(50);}} placeholder={kind === "product" ? "PN, modelo, Interno ou Class. CC" : "Código, descrição, setor ou estação"} /></label>
        <label className="catalog-checkbox"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Mostrar inativos</label>
      </div>
      {!online && <p className="notice">Consulta offline. Conecte-se para alterar os cadastros.</p>}
      {!items && <p role="status">Sincronize para carregar a base de cadastros.</p>}
      {message && <p role="status">{message}</p>}
      <p>{filtered.length} cadastros encontrados</p>
      <div className="catalog-table"><table><thead><tr><th>{kind === "product" ? "PN" : "Código"}</th><th>{kind === "product" ? "Modelo" : "Descrição"}</th><th>{kind === "product" ? "Interno" : "Setor"}</th><th>{kind === "product" ? "Class. CC" : "Estação"}</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {filtered.slice(0,limit).map(i => <tr key={i.id}><td>{i.code}</td><td>{i.label}</td><td>{kind === "product" ? i.internal : i.sector}</td><td>{kind === "product" ? i.classCc : i.station}</td><td>{i.active ? "Ativo" : "Inativo"}</td><td><button className="secondary" disabled={!online} onClick={() => {setEdit({...i});setMessage("");}}>Editar</button></td></tr>)}
        {!filtered.length && items && <tr><td colSpan={6}>Nenhum cadastro encontrado.</td></tr>}
      </tbody></table></div>
      {filtered.length > limit && <button className="secondary" onClick={() => setLimit(limit+50)}>Mostrar mais</button>}
    </div>
    {edit && <Dialog open onOpenChange={open => {if (!open && !busy) setEdit(null);}}><DialogContent className="entry-dialog catalog-dialog"><DialogHeader><DialogTitle>{edit.revision ? "Editar" : "Novo"} {edit.kind === "product" ? "produto" : "defeito"}</DialogTitle><DialogDescription>Inative cadastros que não devem aparecer em novos lançamentos. O histórico será preservado.</DialogDescription></DialogHeader>
      <form onSubmit={save}><div className="form-grid">
        <label>{edit.kind === "product" ? "Part Number (PN)" : "Código"}<input required maxLength={160} value={edit.code} onChange={e => change("code",e.target.value)} /></label>
        <label>{edit.kind === "product" ? "Modelo" : "Descrição"}<input required maxLength={160} value={edit.label} onChange={e => change("label",e.target.value)} /></label>
        {(edit.kind === "product" ? ["internal","classCc"] as const : ["sector","station"] as const).map(key => <label key={key}>{{internal:"Interno",classCc:"Class. CC",sector:"Setor",station:"Estação"}[key]}<input required maxLength={160} list={"catalog-"+key} value={edit[key]} onChange={e => change(key,e.target.value)} /><datalist id={"catalog-"+key}>{[...new Set((items || []).filter(i => i.kind === edit.kind).map(i => i[key]))].filter(Boolean).sort().map(v => <option key={v} value={v} />)}</datalist></label>)}
        <label>Status<select value={edit.active} onChange={e => setEdit({...edit,active:Number(e.target.value)})}><option value={1}>Ativo</option><option value={0}>Inativo</option></select></label>
      </div>{message && <p className="error" role="alert">{message}</p>}<div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={() => setEdit(null)}>Cancelar</button><button disabled={busy || !online}>{busy ? "Salvando…" : "Salvar cadastro"}</button></div></form>
    </DialogContent></Dialog>}
  </section>;
}
