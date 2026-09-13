import type { Entry, Mutation, User } from "@/src/domain/fpy";
export type Pending = { mutation: Mutation; error?: string };
export type LocalState = {
  user: User;
  years: Record<string, { records: Entry[]; at: string }>;
  pending: Pending[];
};
const dbName = "inventus-fpy-v1";
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readLocal(): Promise<LocalState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readonly"),
      r = tx.objectStore("state").get("active");
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeLocal(value: LocalState | null) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    if (value) tx.objectStore("state").put(value, "active");
    else tx.objectStore("state").delete("active");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  }).catch(() => {
    throw new Error(
      "Sem resposta do servidor. Os lançamentos pendentes continuam salvos neste dispositivo.",
    );
  });
  if (!r.ok) {
    const body: any = await r
      .json()
      .catch(() => ({ error: "Sessão expirada ou serviço indisponível." }));
    const e = new Error(body.error || "Falha de conexão.") as Error & {
      status: number;
    };
    e.status = r.status;
    throw e;
  }
  return r.json();
}
export async function loadYear(year: string): Promise<Entry[]> {
  let cursor: string | null = "",
    records: Entry[] = [];
  do {
    const data = await fetchJson(
      "/api/records?year=" +
        year +
        "&cursor=" +
        encodeURIComponent(cursor || ""),
    );
    records = records.concat(data.records);
    cursor = data.next;
  } while (cursor);
  return records;
}
export function visibleEntries(local: LocalState, year: string) {
  const result = new Map(
    (local.years[year]?.records || []).map((e) => [e.id, e]),
  );
  for (const p of local.pending) {
    if (p.error) continue;
    const e = p.mutation.entry;
    if (e.date.startsWith(year)) result.set(e.id, e);
    else if (p.mutation.expectedRevision !== undefined) result.delete(e.id);
  }
  return [...result.values()];
}
