import type { Entry, Group } from "../../../shared/domain/fpy";

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const FAMILIES = ["Todos", "Battery", "Adapter", "LED Driver", "SMT", "Modem", "TP-Link", "Outros"];
export const number = (value: number) => value.toLocaleString("pt-BR");
export const percent = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
export const FPY_TARGET = 98.5;
export const shortLabel = (value: string, length = 22) => value.length > length ? `${value.slice(0, length - 1)}…` : value;

export function familyOf(entry: Pick<Entry, "model" | "line" | "pn">) {
  const value = normalize(`${entry.model} ${entry.line} ${entry.pn}`);
  if (/BATTERY|BATERIA/.test(value)) return "Battery";
  if (/ADAPTER|ADAPTADOR/.test(value)) return "Adapter";
  if (/LED.?DRIVER|DRIVER|LED/.test(value)) return "LED Driver";
  if (/\bSMT\b/.test(value)) return "SMT";
  if (/MODEM/.test(value)) return "Modem";
  if (/TP.?LINK|TPLINK/.test(value)) return "TP-Link";
  return "Outros";
}

export type Metric = { name: string; production: number; defects: number; fpy: number | null; index: number | null };

export function aggregate(groups: Group[], key: (group: Group) => string): Metric[] {
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
