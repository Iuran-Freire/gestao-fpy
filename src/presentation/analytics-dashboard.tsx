"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, Factory, ShieldCheck } from "lucide-react";
import { totalFpy, type Entry, type Group } from "@/src/domain/fpy";

const number = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const dateLabel = (value: string) => value.slice(5).split("-").reverse().join("/");

function aggregate(groups: Group[], field: "date" | "line" | "shift") {
  const result = new Map<string, { name: string; production: number; defects: number }>();
  for (const group of groups) {
    const name = group[field];
    const current = result.get(name) || { name, production: 0, defects: 0 };
    current.production += group.production || 0;
    current.defects += group.defects;
    result.set(name, current);
  }
  return [...result.values()].map((item) => ({
    ...item,
    fpy:
      item.production > 0 && item.defects <= item.production
        ? Number((((item.production - item.defects) / item.production) * 100).toFixed(2))
        : null,
  }));
}

export default function AnalyticsDashboard({
  entries,
  groups,
}: {
  entries: Entry[];
  groups: Group[];
}) {
  const production = groups.reduce((sum, group) => sum + (group.production || 0), 0);
  const defects = groups.reduce((sum, group) => sum + group.defects, 0);
  const fpy = totalFpy(groups);
  const defectRate = production > 0 ? (defects / production) * 100 : null;
  const incomplete = groups.filter((group) => group.production === null || group.issue).length;

  const daily = aggregate(groups, "date")
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-31)
    .map((item) => ({ ...item, label: dateLabel(item.name) }));
  const byLine = aggregate(groups, "line").sort((a, b) => b.production - a.production);
  const byShift = aggregate(groups, "shift").sort((a, b) => a.name.localeCompare(b.name));

  const defectMap = new Map<string, { code: string; description: string; quantity: number }>();
  entries
    .filter((entry) => entry.kind === "defect")
    .forEach((entry) => {
      const current = defectMap.get(entry.code) || {
        code: entry.code,
        description: entry.description,
        quantity: 0,
      };
      current.quantity += entry.quantity;
      defectMap.set(entry.code, current);
    });
  const defectsByCode = [...defectMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  if (!groups.length) {
    return (
      <section className="panel dashboard-empty">
        <Activity size={34} />
        <h2>Sem dados para os filtros selecionados</h2>
        <p>Altere o período ou registre produção e defeitos para gerar os indicadores.</p>
      </section>
    );
  }

  return (
    <div className="analytics">
      <div className="metrics analytics-metrics">
        <article className="metric highlight">
          <span>FPY DO PERÍODO</span>
          <strong>{percent(fpy)}</strong>
          <p>Aprovação na primeira passagem</p>
          <Activity className="metric-icon" />
        </article>
        <article className="metric">
          <span>PRODUÇÃO</span>
          <strong>{number(production)}</strong>
          <p>Peças produzidas</p>
          <Factory className="metric-icon neutral" />
        </article>
        <article className="metric">
          <span>DEFEITOS</span>
          <strong>{number(defects)}</strong>
          <p>{percent(defectRate)} da produção</p>
          <AlertTriangle className="metric-icon neutral" />
        </article>
        <article className="metric">
          <span>GRUPOS A VERIFICAR</span>
          <strong>{number(incomplete)}</strong>
          <p>Sem produção ou com inconsistência</p>
          <ShieldCheck className="metric-icon neutral" />
        </article>
      </div>

      <div className="chart-grid">
        <section className="panel chart-card chart-wide">
          <div className="panel-head">
            <div><h2>Evolução diária do FPY</h2><span>Últimos 31 dias dentro do período filtrado</span></div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8ed" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => value + "%"} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [percent(Number(value)), "FPY"]} />
                <Line type="monotone" dataKey="fpy" stroke="#df690f" strokeWidth={3} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-card">
          <div className="panel-head">
            <div><h2>Produção e defeitos por linha</h2><span>Comparativo das linhas selecionadas</span></div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byLine} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8ed" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => number(Number(value))} />
                <Bar dataKey="production" name="Produção" fill="#3e586f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="defects" name="Defeitos" fill="#e87524" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-card">
          <div className="panel-head">
            <div><h2>FPY por turno</h2><span>Resultado consolidado por turno</span></div>
          </div>
          <div className="shift-results">
            {byShift.map((item) => (
              <div className="shift-result" key={item.name}>
                <span>{item.name}º turno</span>
                <strong>{percent(item.fpy)}</strong>
                <small>{number(item.production)} produzidas · {number(item.defects)} defeitos</small>
                <div><i style={{ width: Math.max(0, item.fpy || 0) + "%" }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel chart-card chart-wide">
          <div className="panel-head">
            <div><h2>Principais códigos de defeito</h2><span>Ranking por quantidade registrada</span></div>
          </div>
          {defectsByCode.length ? (
            <div className="defect-ranking">
              {defectsByCode.map((item, index) => (
                <div className="ranking-row" key={item.code}>
                  <span className="ranking-position">{index + 1}</span>
                  <div><b>{item.code}</b><small>{item.description || "Sem descrição"}</small></div>
                  <div className="ranking-bar"><i style={{ width: (item.quantity / defectsByCode[0].quantity) * 100 + "%" }} /></div>
                  <strong>{number(item.quantity)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="chart-placeholder">Nenhum defeito registrado no período.</p>
          )}
        </section>
      </div>
    </div>
  );
}
