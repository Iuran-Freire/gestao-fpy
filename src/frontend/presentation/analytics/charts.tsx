"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { number, percent, shortLabel, type Metric } from "../../application/analytics/metrics";

type TooltipItem = { name?: string; value?: number; color?: string };
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="dashboard-tooltip"><b>{label}</b>{payload.map((item) => <span key={item.name} style={{ color: item.color }}>{item.name}: {item.name === "Produção" || item.name === "Defeitos" ? number(Number(item.value)) : percent(Number(item.value))}</span>)}</div>;
}

export function YieldChart({ data, title, subtitle }: { data: Array<Metric & { label?: string }>; title: string; subtitle: string }) {
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

export function RankingChart({ data, title, subtitle, empty }: { data: Ranking[]; title: string; subtitle: string; empty: string }) {
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
