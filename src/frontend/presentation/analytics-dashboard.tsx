"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Factory, RotateCcw, ShieldCheck } from "lucide-react";
import { isoWeek, summarize, totalFpy, type Entry, type Group } from "@/src/shared/domain/fpy";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const FAMILIES = ["Todos", "Battery", "Adapter", "LED Driver", "SMT", "Modem", "TP-Link", "Outros"];
const number = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const FPY_TARGET = 98.5;
const shortLabel = (value: string, length = 22) => value.length > length ? `${value.slice(0, length - 1)}…` : value;

function familyOf(entry: Pick<Entry, "model" | "line" | "pn">) {
  const value = normalize(`${entry.model} ${entry.line} ${entry.pn}`);
  if (/BATTERY|BATERIA/.test(value)) return "Battery";
  if (/ADAPTER|ADAPTADOR/.test(value)) return "Adapter";
  if (/LED.?DRIVER|DRIVER|LED/.test(value)) return "LED Driver";
  if (/\bSMT\b/.test(value)) return "SMT";
  if (/MODEM/.test(value)) return "Modem";
  if (/TP.?LINK|TPLINK/.test(value)) return "TP-Link";
  return "Outros";
}

type Metric = { name: string; production: number; defects: number; fpy: number | null; index: number | null };

function aggregate(groups: Group[], key: (group: Group) => string): Metric[] {
  const result = new Map<string, { name: string; production: number; defects: number }>();
  for (const group of groups) {
    const name = key(group);
    const current = result.get(name) || { name, production: 0, defects: 0 };
    current.production += group.production || 0;
    current.defects += group.defects;
    result.set(name, current);
  }
  return [...result.values()].map((item) => ({
    ...item,
    fpy: item.production > 0 && item.defects <= item.production ? Number((((item.production - item.defects) / item.production) * 100).toFixed(2)) : null,
    index: item.production > 0 ? Number(((item.defects / item.production) * 100).toFixed(2)) : null,
  }));
}

type TooltipItem = { name?: string; value?: number; color?: string };
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="dashboard-tooltip"><b>{label}</b>{payload.map((item) => <span key={item.name} style={{ color: item.color }}>{item.name}: {item.name === "Produção" || item.name === "Defeitos" ? number(Number(item.value)) : percent(Number(item.value))}</span>)}</div>;
}

function YieldChart({ data, title, subtitle }: { data: Array<Metric & { label?: string }>; title: string; subtitle: string }) {
  const gradient = `yield-${title.replace(/\W/g, "")}`;
  return <section className="panel chart-card">
    <div className="panel-head"><div><h2>{title}</h2><span>{subtitle}</span></div></div>
    <div className="chart-area powerbi-chart"><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 16, right: 16, left: -12, bottom: 4 }}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f49a39" stopOpacity={0.55} /><stop offset="100%" stopColor="#f49a39" stopOpacity={0.12} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e8eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
        <YAxis domain={["dataMin - 1", 100]} tickFormatter={(value) => value + "%"} tick={{ fontSize: 11 }} />
        <ReferenceLine y={98.5} stroke="#e45252" strokeDasharray="5 4" />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="fpy" name="FPY" stroke="#ef881b" strokeWidth={3} fill={`url(#${gradient})`} dot={{ r: 4, fill: "#ef881b" }} connectNulls />
      </AreaChart>
    </ResponsiveContainer></div>
  </section>;
}

type Ranking = { name: string; quantity: number; index: number | null; fpy?: number | null };
function RankingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: Ranking }>; label?: string }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="dashboard-tooltip ranking-tooltip"><b>{label}</b><span>Índice de falhas: {percent(item.index)}</span><span>Quantidade: {number(item.quantity)}</span></div>;
}

function RankingChart({ data, title, subtitle, empty }: { data: Ranking[]; title: string; subtitle: string; empty: string }) {
  return <section className="panel chart-card ranking-card">
    <div className="panel-head"><div><h2>{title}</h2><span>{subtitle}</span></div></div>
    {data.length ? <div className="chart-area ranking-chart"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, left: 10, bottom: 8 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e8eb" />
        <XAxis type="number" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={122} tickFormatter={(value) => shortLabel(String(value))} tick={{ fontSize: 11, fill: "#4d5a66" }} axisLine={false} tickLine={false} />
        <Tooltip content={<RankingTooltip />} cursor={{ fill: "#fff3e6" }} />
        <Bar dataKey="index" name="Índice de falhas" fill="#ef9a3d" radius={[0, 4, 4, 0]} maxBarSize={27}>
          <LabelList dataKey="index" position="right" formatter={(value) => `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} fill="#6a5138" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div> : <div className="chart-empty">{empty}</div>}
  </section>;
}

export default function AnalyticsDashboard({ entries, year, onYearChange }: { entries: Entry[]; year: string; onYearChange: (year: string) => void }) {
  const [family, setFamily] = useState("Todos");
  const [month, setMonth] = useState("all");
  const [week, setWeek] = useState("all");
  const [shift, setShift] = useState("all");
  const [line, setLine] = useState("all");
  const [model, setModel] = useState("all");

  const lines = useMemo(() => [...new Set(entries.map((entry) => entry.line))].sort(), [entries]);
  const models = useMemo(() => {
    const unique = new Map<string, string>();
    entries.forEach((entry) => {
      const key = normalize(entry.model);
      if (!unique.has(key)) unique.set(key, entry.model);
    });
    return [...unique].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);
  const weeks = useMemo(() => [...new Set(entries.map((entry) => isoWeek(entry.date).week))].sort((a, b) => a - b), [entries]);
  const filteredEntries = useMemo(() => entries.filter((entry) =>
    (family === "Todos" || familyOf(entry) === family) &&
    (month === "all" || Number(entry.date.slice(5, 7)) === Number(month)) &&
    (week === "all" || isoWeek(entry.date).week === Number(week)) &&
    (shift === "all" || entry.shift === shift) &&
    (line === "all" || entry.line === line) &&
    (model === "all" || normalize(entry.model) === model)
  ), [entries, family, month, week, shift, line, model]);
  const groups = useMemo(() => summarize(filteredEntries), [filteredEntries]);
  const production = groups.reduce((sum, group) => sum + (group.production || 0), 0);
  const defects = groups.reduce((sum, group) => sum + group.defects, 0);
  const fpy = totalFpy(groups);
  const defectRate = production > 0 ? (defects / production) * 100 : null;
  const incomplete = groups.filter((group) => group.production === null || group.issue).length;

  const monthly = aggregate(groups, (group) => group.date.slice(5, 7)).sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ ...item, label: MONTHS[Number(item.name) - 1] }));
  const weekly = aggregate(groups, (group) => String(isoWeek(group.date).week)).sort((a, b) => Number(a.name) - Number(b.name)).map((item) => ({ ...item, label: `S${item.name}` }));
  const daily = aggregate(groups, (group) => group.date).sort((a, b) => a.name.localeCompare(b.name)).slice(-31).map((item) => ({ ...item, label: item.name.slice(8, 10) }));
  const byModel = aggregate(groups, (group) => group.model).filter((item) => item.index !== null).sort((a, b) => (b.index || 0) - (a.index || 0)).slice(0, 5);

  const failures = new Map<string, number>();
  filteredEntries.filter((entry) => entry.kind === "defect").forEach((entry) => {
    const name = entry.description || entry.code || "Sem descrição";
    failures.set(name, (failures.get(name) || 0) + entry.quantity);
  });
  const byFailure = [...failures].map(([name, quantity]) => ({
    name, quantity,
    index: production > 0 ? Number(((quantity / production) * 100).toFixed(2)) : null,
    fpy: production > 0 ? Number((100 - (quantity / production) * 100).toFixed(2)) : null,
  })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const primaryFailure = byFailure[0];
  const targetGap = fpy === null ? null : Number((fpy - FPY_TARGET).toFixed(2));
  const primaryFailureShare = primaryFailure && defects > 0 ? (primaryFailure.quantity / defects) * 100 : null;
  const topDefectsByShift = ["1", "2", "3"].map((shiftNumber) => {
    const totals = new Map<string, { code: string; description: string; quantity: number }>();
    filteredEntries.filter((entry) => entry.kind === "defect" && entry.shift === shiftNumber).forEach((entry) => {
      const key = `${entry.code}|${entry.description}`;
      const current = totals.get(key) || { code: entry.code, description: entry.description || "Sem descrição", quantity: 0 };
      current.quantity += entry.quantity;
      totals.set(key, current);
    });
    return { shift: shiftNumber, items: [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5) };
  });

  const familyEntries = entries.filter((entry) =>
    (month === "all" || Number(entry.date.slice(5, 7)) === Number(month)) &&
    (week === "all" || isoWeek(entry.date).week === Number(week)) &&
    (shift === "all" || entry.shift === shift) &&
    (line === "all" || entry.line === line) &&
    (model === "all" || normalize(entry.model) === model)
  );
  const familySummary = FAMILIES.slice(1).map((name) => {
    const selectedEntries = familyEntries.filter((entry) => familyOf(entry) === name);
    return { name, fpy: totalFpy(summarize(selectedEntries)) };
  }).filter((item) => item.fpy !== null);

  function resetFilters() {
    setFamily("Todos"); setMonth("all"); setWeek("all"); setShift("all"); setLine("all"); setModel("all");
  }

  return <div className="analytics powerbi-dashboard">
    <section className="panel dashboard-controls">
      <div className="family-tabs" aria-label="Família de produto">{FAMILIES.map((item) => <button key={item} className={family === item ? "active" : ""} onClick={() => setFamily(item)}>{item === "Todos" ? "Todo FPY" : item}</button>)}</div>
      <div className="dashboard-filters">
        <label>Ano<select value={year} onChange={(event) => onYearChange(event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(new Date().getFullYear() - index)).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Mês<select value={month} onChange={(event) => { setMonth(event.target.value); setWeek("all"); }}><option value="all">Todos</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
        <label>Semana ISO<select value={week} onChange={(event) => setWeek(event.target.value)}><option value="all">Todas</option>{weeks.map((item) => <option value={item} key={item}>Semana {item}</option>)}</select></label>
        <label>Turno<select value={shift} onChange={(event) => setShift(event.target.value)}><option value="all">Todos</option><option value="1">1º turno</option><option value="2">2º turno</option><option value="3">3º turno</option></select></label>
        <label>Linha<select value={line} onChange={(event) => setLine(event.target.value)}><option value="all">Todas</option>{lines.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Modelo<select value={model} onChange={(event) => setModel(event.target.value)}><option value="all">Todos</option>{models.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <button className="secondary reset-dashboard" onClick={resetFilters}><RotateCcw size={16} /> Limpar</button>
      </div>
    </section>

    {!groups.length ? <section className="panel dashboard-empty"><Activity size={34} /><h2>Sem dados para os filtros selecionados</h2><p>Altere os filtros ou registre produção e defeitos para gerar os indicadores.</p></section> : <>
      <div className="metrics analytics-metrics">
        <article className="metric highlight"><span>FPY DO PERÍODO</span><strong>{percent(fpy)}</strong><p>{targetGap === null ? "Sem base de produção" : `${Math.abs(targetGap).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p. ${targetGap >= 0 ? "acima" : "abaixo"} da meta`}</p><Activity className="metric-icon" /></article>
        <article className="metric"><span>PRODUÇÃO</span><strong>{number(production)}</strong><p>Peças produzidas</p><Factory className="metric-icon neutral" /></article>
        <article className="metric"><span>ÍNDICE DE FALHAS</span><strong>{percent(defectRate)}</strong><p>{number(defects)} defeitos registrados</p><AlertTriangle className="metric-icon neutral" /></article>
        <article className="metric"><span>GRUPOS A VERIFICAR</span><strong>{number(incomplete)}</strong><p>Sem produção ou inconsistentes</p><ShieldCheck className="metric-icon neutral" /></article>
      </div>
      <section className="analysis-insights" aria-label="Leitura analítica do período">
        <article><span>Meta de FPY</span><strong>{FPY_TARGET.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%</strong><p>{targetGap === null ? "Aguardando produção para comparar." : targetGap >= 0 ? "Resultado dentro da meta definida." : "Resultado abaixo da meta definida."}</p></article>
        <article><span>Principal causa</span><strong>{primaryFailure ? shortLabel(primaryFailure.name, 34) : "Sem defeitos"}</strong><p>{primaryFailure ? `${number(primaryFailure.quantity)} ocorrências no período` : "Não há falhas registradas."}</p></article>
        <article><span>Concentração da causa</span><strong>{percent(primaryFailureShare)}</strong><p>{primaryFailure ? "Participação da principal causa nas falhas." : "Sem base para cálculo."}</p></article>
      </section>
      <div className="powerbi-grid">
        <YieldChart data={monthly} title="FPY por mês" subtitle="Resultado mensal" />
        <RankingChart data={byFailure} title="Falhas críticas · Top 5" subtitle="Impacto de cada falha sobre a produção" empty="Não há falhas registradas neste período." />
        <YieldChart data={weekly} title="FPY por semana" subtitle="Resultado semanal" />
        <RankingChart data={byModel.map((item) => ({ ...item, quantity: item.defects }))} title="Modelos com maior perda · Top 5" subtitle="Índice de falhas por modelo" empty="Não há modelos com produção para comparar." />
        <YieldChart data={daily} title="FPY por dia" subtitle="Resultado diário · últimos 31 dias" />
        <RankingChart data={familySummary.map((item) => ({ ...item, quantity: 0, index: item.fpy }))} title="Comparação por família" subtitle="Índice de falhas por processo" empty="Não há famílias com produção para comparar." />
        <section className="panel chart-card chart-wide shift-defects"><div className="panel-head"><div><h2>Top defeitos por turno</h2><span>As cinco falhas com maior quantidade em cada turno</span></div></div><div className="shift-defect-grid">{topDefectsByShift.map((group) => <article key={group.shift}><h3>{group.shift}º turno</h3>{group.items.length ? group.items.map((item, index) => <div className="shift-defect-row" key={`${item.code}-${item.description}`}><span className="rank">{index + 1}</span><div><b>{item.code}</b><small>{item.description}</small><i style={{ width: `${Math.max(6, (item.quantity / group.items[0].quantity) * 100)}%` }} /></div><strong>{number(item.quantity)}</strong></div>) : <p>Sem defeitos no período.</p>}</article>)}</div></section>
      </div>
    </>}
  </div>;
}
