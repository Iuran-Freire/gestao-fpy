export type Role = "operador" | "supervisor" | "lider" | "tecnica";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  owner: number;
  username?: string | null;
  active?: number;
  revision?: number;
  mustChange?: boolean;
  hasPassword?: boolean;
  backupAvailable?: boolean;
};
export type Entry = {
  id: string;
  kind: "production" | "defect";
  date: string;
  shift: string;
  line: string;
  pn: string;
  model: string;
  quantity: number;
  code: string;
  description: string;
  position: string;
  station: string;
  category: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export type Mutation = {
  id: string;
  entry: Entry;
  expectedRevision?: number;
  reason?: string;
};
export function canCorrect(role: Role) {
  return role !== "operador";
}
export function groupKey(e: Pick<Entry, "date" | "shift" | "line" | "pn">) {
  return JSON.stringify([
    e.date,
    e.shift,
    e.line.trim().toUpperCase(),
    e.pn.trim().toUpperCase(),
  ]);
}
export function validateEntry(input: unknown): Entry {
  if (!input || typeof input !== "object") throw Error("Registro inválido.");
  const e = { ...input } as Entry;
  if (
    !/^[a-zA-Z0-9-]{8,80}$/.test(e.id) ||
    !["production", "defect"].includes(e.kind)
  )
    throw Error("Identificação inválida.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
    !Number.isFinite(Date.parse(e.date + "T12:00:00Z")) ||
    new Date(e.date + "T12:00:00Z").toISOString().slice(0, 10) !== e.date
  )
    throw Error("Data inválida.");
  if (!["1", "2", "3"].includes(e.shift)) throw Error("Selecione o turno.");
  for (const k of [
    "line",
    "pn",
    "model",
    "code",
    "description",
    "position",
    "station",
    "category",
  ] as const) {
    if (typeof e[k] !== "string" || e[k].length > 160)
      throw Error("Campo inválido: " + k);
    e[k] = e[k].trim();
  }
  if (!e.line || !e.pn || !e.model) throw Error("Informe linha, PN e modelo.");
  e.line = e.line.toUpperCase();
  e.pn = e.pn.toUpperCase();
  e.code = e.code.toUpperCase();
  e.position = e.position.toUpperCase();
  if (
    !Number.isSafeInteger(e.quantity) ||
    e.quantity < 0 ||
    e.quantity > 10000000 ||
    (e.kind === "defect" && e.quantity === 0)
  )
    throw Error("Informe uma quantidade inteira válida.");
  if (e.kind === "defect" && (!e.code || !e.position))
    throw Error("Informe código e posição mecânica.");
  if (e.kind === "production") {
    e.code = "";
    e.description = "";
    e.position = "";
    e.station = "";
    e.category = "";
  }
  return e;
}
export function isoWeek(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear();
  return {
    year: y,
    week: Math.ceil(((+d - +new Date(Date.UTC(y, 0, 1))) / 86400000 + 1) / 7),
  };
}
export type Group = {
  key: string;
  date: string;
  shift: string;
  line: string;
  pn: string;
  model: string;
  production: number | null;
  defects: number;
  count: number;
  fpy: number | null;
  issue: boolean;
};
export function summarize(entries: Entry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const key = groupKey(e);
    const g = map.get(key) || {
      key,
      date: e.date,
      shift: e.shift,
      line: e.line,
      pn: e.pn,
      model: e.model,
      production: null,
      defects: 0,
      count: 0,
      fpy: null,
      issue: false,
    };
    if (e.kind === "production") g.production = e.quantity;
    else g.defects += e.quantity;
    g.count++;
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      issue: g.production !== null && g.defects > g.production,
      fpy:
        g.production !== null && g.production > 0 && g.defects <= g.production
          ? ((g.production - g.defects) / g.production) * 100
          : null,
    }))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift),
    );
}
export function totalFpy(groups: Group[]) {
  if (!groups.length || groups.some((g) => g.production === null || g.issue))
    return null;
  const p = groups.reduce((s, g) => s + (g.production || 0), 0),
    d = groups.reduce((s, g) => s + g.defects, 0);
  return p > 0 ? ((p - d) / p) * 100 : null;
}
