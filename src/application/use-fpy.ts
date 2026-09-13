"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readLocal,
  writeLocal,
  fetchJson,
  loadYear,
  visibleEntries,
  type LocalState,
} from "@/src/infrastructure/offline";
import {
  groupKey,
  type Entry,
  type Mutation,
  type User,
} from "@/src/domain/fpy";
async function locked<T>(fn: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request("fpy-state", fn) : fn();
}
export function useFpy() {
  const [local, setLocal] = useState<LocalState | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(true),
    [year, setYear] = useState(String(new Date().getFullYear()));
  const activeYear = useRef(year);
  activeYear.current = year;
  const reload = useCallback(async () => {
    setLocal(await readLocal());
  }, []);
  const sync = useCallback(async () => {
    setBusy(true);
    try {
      await locked(async () => {
        let s = await readLocal();
        const user: User = await fetchJson("/api/session");
        if (s && s.user.id !== user.id) {
          if (s.pending.length)
            throw Error(
              "Há lançamentos pendentes de outra conta. Entre novamente com a conta anterior.",
            );
          s = null;
        }
        if (!s) s = { user, years: {}, pending: [] };
        s.user = user;
        await writeLocal(s);
        if (user.mustChange) {
          setLocal({ ...s });
          setMessage("Troque a senha temporária para continuar.");
          return;
        }
        for (const pending of [...s.pending]) {
          try {
            await fetchJson("/api/records", {
              method: "POST",
              body: JSON.stringify(pending.mutation),
            });
            const sent = pending.mutation.entry;
            for (const data of Object.values(s.years))
              data.records = data.records.filter((r) => r.id !== sent.id);
            const y = sent.date.slice(0, 4);
            if (s.years[y])
              s.years[y].records.push({
                ...sent,
                revision:
                  pending.mutation.expectedRevision !== undefined
                    ? pending.mutation.expectedRevision + 1
                    : 1,
              });
            s.pending = s.pending.filter(
              (p) => p.mutation.id !== pending.mutation.id,
            );
            await writeLocal(s);
          } catch (e) {
            const err = e as Error & { status?: number };
            const transient =
              !err.status || err.status === 401 || err.status >= 500;
            pending.error = transient ? undefined : err.message;
            await writeLocal(s);
            if (transient) throw err;
          }
        }
        const years = new Set([activeYear.current, ...Object.keys(s.years)]);
        for (const y of years) {
          const records = await loadYear(y);
          s.years[y] = { records, at: new Date().toISOString() };
          await writeLocal(s);
        }
        setLocal({ ...s });
        setMessage(
          s.pending.length
            ? "Alguns envios precisam de atenção. Veja Sincronização."
            : "Dados sincronizados.",
        );
      });
    } catch (e) {
      setMessage((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
      setReady(true);
    }
  }, [reload]);
  useEffect(() => {
    setOnline(navigator.onLine);
    readLocal()
      .then((s) => {
        setLocal(s);
        setReady(true);
        if (navigator.onLine) void sync();
      })
      .catch(() => {
        setReady(true);
        setMessage(
          "O armazenamento do navegador está indisponível. Não é seguro lançar offline neste dispositivo.",
        );
      });
    const connected = () => {
        setOnline(true);
        void sync();
      },
      disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    const timer = setInterval(() => {
      if (navigator.onLine) void sync();
    }, 120000);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
      clearInterval(timer);
    };
  }, [sync]);
  async function save(
    entries: Entry[],
    edit?: { revision: number; reason: string },
  ) {
    await locked(async () => {
      const s = await readLocal();
      if (!s) throw Error("Entre com sua conta antes de lançar.");
      for (const e of entries) {
        if (
          !edit &&
          e.kind === "production" &&
          visibleEntries(s, e.date.slice(0, 4)).some(
            (r) => r.kind === "production" && groupKey(r) === groupKey(e),
          )
        )
          throw Error(
            "Já existe produção para esta data, turno, linha e PN. Solicite uma correção.",
          );
        if (s.pending.some((p) => p.mutation.entry.id === e.id))
          throw Error(
            "Sincronize ou resolva o envio pendente antes de corrigir.",
          );
        const mutation: Mutation = {
          id: crypto.randomUUID(),
          entry: e,
          ...(edit
            ? { expectedRevision: edit.revision, reason: edit.reason }
            : {}),
        };
        s.pending.push({ mutation });
      }
      await writeLocal(s);
      setLocal({ ...s });
    });
    void navigator.storage?.persist?.().catch(() => {});
    if (navigator.onLine) void sync();
    else setMessage("Salvo neste dispositivo. Envio pendente de conexão.");
  }
  async function discard(id: string) {
    await locked(async () => {
      const s = await readLocal();
      if (!s) return;
      const p = s.pending.find((x) => x.mutation.id === id);
      if (!p?.error)
        throw Error("Somente envios recusados podem ser descartados.");
      s.pending = s.pending.filter((x) => x.mutation.id !== id);
      await writeLocal(s);
      setLocal({ ...s });
    });
  }
  async function logout() {
    try {
      await locked(async () => {
        const current = await readLocal();
        if (current?.pending.length) throw Error("Sincronize os lançamentos pendentes antes de sair.");
        await fetchJson("/api/auth/logout", { method: "POST" });
        await writeLocal(null);
        setLocal(null);
      });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return {
    local,
    ready,
    busy,
    message,
    setMessage,
    online,
    year,
    setYear,
    sync,
    save,
    discard,
    logout,
    entries: local ? visibleEntries(local, year) : [],
  };
}
