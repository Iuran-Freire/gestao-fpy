"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { validateEntry, type Entry, type User } from "@/src/domain/fpy";
import type { CatalogItem } from "@/src/domain/catalog";

export function Choice({ label, value, onChange, items }: {
  label: string; value: string; onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return <label>{label}<Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue /></SelectTrigger><SelectContent>{items.map(i => <SelectItem value={i.value} key={i.value}>{i.label}</SelectItem>)}</SelectContent></Select></label>;
}

type DefectRow = { quantity: string; code: string; description: string; position: string; station: string; catalogId: string };
export function EntryForm({ kind, editing, user, catalog, onClose, onSave }: {
  kind: "production" | "defect"; editing?: Entry; user: User; entries: Entry[];
  catalog?: CatalogItem[]; onClose: () => void;
  onSave: (entries: Entry[], edit?: { revision: number; reason: string }) => Promise<void>;
}) {
  const products = (catalog || []).filter(i => i.kind === "product" && i.active === 1);
  const defects = (catalog || []).filter(i => i.kind === "defect" && i.active === 1);
  const [context, setContext] = useState(() => {
    let previous: Record<string,string> = {};
    try { previous = JSON.parse(localStorage.getItem("fpy-context") || "{}"); } catch { /* Optional preferences. */ }
    const saved = products.find(p => p.code === previous.pn);
    return { date: editing?.date || new Date().toLocaleDateString("en-CA"), shift: editing?.shift || previous.shift || "1",
      line: editing?.line || previous.line || "", pn: editing?.pn || saved?.code || "",
      model: editing?.model || saved?.label || "", category: editing ? editing.category : saved?.internal || "",
      classCc: editing?.classCc || (editing ? "" : saved?.classCc || "") };
  });
  const [productChanged,setProductChanged] = useState(false);
  const [productSearch,setProductSearch] = useState("");
  const [defectSearch,setDefectSearch] = useState("");
  const [items,setItems] = useState<DefectRow[]>([{ quantity:String(editing?.quantity ?? ""),code:editing?.code || "",description:editing?.description || "",position:editing?.position || "",station:editing?.station || "",catalogId:"" }]);
  const [reason,setReason] = useState("");
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  const visibleProducts = products.filter(p => p.code === context.pn || `${p.code} ${p.label} ${p.internal} ${p.classCc}`.toLowerCase().includes(productSearch.toLowerCase()));
  const visibleDefects = defects.filter(d => items.some(i => i.catalogId === d.id) || `${d.code} ${d.label} ${d.sector} ${d.station}`.toLowerCase().includes(defectSearch.toLowerCase()));
  function field(key: keyof typeof context,value:string) { setContext(c => ({...c,[key]:value})); }
  function itemField(index:number,key:keyof DefectRow,value:string) { setItems(rows => rows.map((r,i) => i === index ? {...r,[key]:value} : r)); }
  async function submit(event:React.FormEvent) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      if ((!editing || productChanged) && !products.some(p => p.code === context.pn)) throw Error("Selecione um PN ativo na base de cadastros.");
      if (items.some(i => !i.quantity.trim())) throw Error("Informe a quantidade.");
      if (kind === "defect" && items.some(i => !i.catalogId && !editing)) throw Error("Selecione os defeitos na base de cadastros.");
      if (editing && !reason.trim()) throw Error("Informe o motivo da correção.");
      const now = new Date().toISOString();
      const records = items.map(i => validateEntry({ ...context, code:i.code,description:i.description,position:i.position,station:i.station,
        id:editing?.id || crypto.randomUUID(),kind,quantity:Number(i.quantity),author:editing?.author || user.name,
        createdAt:editing?.createdAt || now,updatedAt:now,revision:editing?.revision || 1 }));
      await onSave(records,editing ? {revision:editing.revision,reason} : undefined);
      try { localStorage.setItem("fpy-context",JSON.stringify(context)); } catch { /* Already saved. */ }
      onClose();
    } catch(e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => {if (!open && !saving) onClose();}}><DialogContent className="entry-dialog"><DialogHeader><DialogTitle>{editing ? "Corrigir registro" : kind === "production" ? "Informar produção" : "Lançar defeitos"}</DialogTitle><DialogDescription>{kind === "production" ? "Um único total por data, turno, linha e PN." : "Selecione o produto e adicione os defeitos encontrados."}</DialogDescription></DialogHeader>
    <form onSubmit={submit}>
      <div className="form-section"><h3>Identificação da produção</h3><div className="form-grid">
        <label>Data<input type="date" required value={context.date} onChange={e => field("date",e.target.value)} /></label>
        <Choice label="Turno" value={context.shift} onChange={v => field("shift",v)} items={["1","2","3"].map(value => ({value,label:value+"º turno"}))} />
        <label>Linha<input required maxLength={160} placeholder="Ex.: SMT-1" value={context.line} onChange={e => field("line",e.target.value)} /></label>
        <label>Buscar produto<input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="PN, modelo ou classificação" /></label>
        <Choice label="PN / Modelo" value={context.pn || "select-product"} onChange={pn => {
          const product = products.find(p => p.code === pn); if (!product) return;
          setProductChanged(true); setContext(c => ({...c,pn,model:product.label,category:product.internal,classCc:product.classCc}));
        }} items={[
          {value:"select-product",label:"Selecione o produto"},
          ...(editing && !productChanged ? [{value:editing.pn,label:editing.pn+" · "+editing.model+" (registro original)"}] : []),
          ...visibleProducts.filter(p => !editing || productChanged || p.code !== editing.pn).map(p => ({value:p.code,label:p.code+" · "+p.label})),
        ]} />
        <label>Interno<input readOnly value={context.category} placeholder="Preenchido pelo PN" /></label>
        <label>Class. CC<input readOnly value={context.classCc} placeholder={editing ? "Não informado no registro original" : "Preenchido pelo PN"} /></label>
      </div>{!catalog && <p className="notice">Sincronize para baixar os cadastros antes de fazer novos lançamentos.</p>}
      {catalog && !products.length && <p className="notice">Nenhum produto ativo. Cadastre em Gestão → Cadastros.</p>}</div>
      <div className="form-section"><h3>{kind === "production" ? "Total produzido no turno" : "Defeitos da primeira passagem"}</h3>
        {kind === "defect" && <label>Buscar defeito<input value={defectSearch} onChange={e => setDefectSearch(e.target.value)} placeholder="Código, descrição, setor ou estação" /></label>}
        {items.map((item,index) => <div className="defect-item" key={index}>
          {kind === "defect" && <div className="item-title"><b>Defeito {index+1}</b>{items.length>1 && <button type="button" className="icon-button" aria-label={"Remover defeito "+(index+1)} onClick={() => setItems(items.filter((_,i) => i!==index))}><Trash2 size={17}/></button>}</div>}
          <div className="form-grid">
            <label>Quantidade<input type="number" inputMode="numeric" min={kind === "production" ? 0 : 1} max={10000000} step={1} required value={item.quantity} onChange={e => itemField(index,"quantity",e.target.value)} /></label>
            {kind === "defect" && <>
              <Choice label="Código do defeito" value={item.catalogId || "original"} onChange={id => {
                const defect = defects.find(d => d.id === id); if (!defect) return;
                setItems(rows => rows.map((r,i) => i === index ? {...r,catalogId:id,code:defect.code,description:defect.label,station:defect.station} : r));
              }} items={[{value:"original",label:editing ? `${editing.code} · ${editing.description} (registro original)` : "Selecione o defeito"},...visibleDefects.map(d => ({value:d.id,label:`${d.code} · ${d.label} · ${d.sector} / ${d.station}`}))]} />
              <label>Estação<input readOnly value={item.station} /></label>
              <label>Posição mecânica<input required maxLength={160} placeholder="Ex.: U2, R24, C1" value={item.position} onChange={e => itemField(index,"position",e.target.value)} /></label>
              <label>Descrição do defeito<input readOnly value={item.description} /></label>
            </>}
          </div>
        </div>)}
        {kind === "defect" && !editing && <button type="button" className="secondary" onClick={() => setItems([...items,{quantity:"",code:"",description:"",position:"",station:"",catalogId:""}])}><Plus size={17}/>Adicionar outro defeito</button>}
      </div>
      {editing && <label>Motivo da correção<input required maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      <p className="form-hint">Responsável: {user.name}. {kind === "defect" ? "Cada peça deve ser contada uma única vez." : "O total informado será usado no cálculo do FPY."}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-footer"><button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancelar</button><button disabled={saving || (!editing && !catalog)}>{saving ? "Salvando…" : editing ? "Salvar correção" : kind === "production" ? "Salvar produção" : "Salvar lançamentos"}</button></div>
    </form>
  </DialogContent></Dialog>;
}
