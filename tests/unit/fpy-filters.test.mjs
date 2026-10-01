import test from "node:test";
import assert from "node:assert/strict";
import {
  localDate,
  periodRange,
  periodYears,
  filterFpyEntries,
} from "../../src/frontend/application/fpy-filters.ts";
import { summarize } from "../../src/shared/domain/fpy.ts";

const blank = { from: "", to: "" };
const base = {
  id: "production-1", kind: "production", date: "2026-09-23", shift: "1",
  line: "SMT-1", pn: "PN-1", model: "Módulo teste", quantity: 100,
  code: "", description: "", position: "", station: "", category: "",
  author: "Operador", createdAt: "", updatedAt: "", revision: 1,
};
const entries = [
  base,
  { ...base, id: "defect-1", kind: "defect", quantity: 2, code: "A01", description: "Contaminação", position: "C1" },
  { ...base, id: "defect-2", kind: "defect", quantity: 3, code: "A02", description: "Componente ausente", position: "R4" },
];
const filters = { from: "2026-09-01", to: "2026-09-30", shift: "all", line: "all", search: "" };

test("atalhos respeitam o dia local e a semana de segunda a domingo entre anos", () => {
  const previousTz = process.env.TZ;
  try {
    process.env.TZ = "America/Manaus";
    assert.equal(localDate(new Date("2026-09-24T02:30:00Z")), "2026-09-23");
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
  assert.deepEqual(periodRange("today", blank, "2026-09-23"), { from: "2026-09-23", to: "2026-09-23" });
  const week = periodRange("week", blank, "2021-01-01");
  assert.deepEqual(week, { from: "2020-12-28", to: "2021-01-03" });
  assert.deepEqual(periodYears(week), ["2020", "2021"]);
  assert.deepEqual(periodRange("week", blank, "2021-01-03"), week);
});

test("mês inclui fevereiro bissexto e ano completo mantém janeiro a dezembro", () => {
  assert.deepEqual(periodRange("month", blank, "2024-02-15"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(periodRange("month", blank, "2026-12-31"), { from: "2026-12-01", to: "2026-12-31" });
  assert.deepEqual(periodRange("year:2020", blank, "2026-09-23"), { from: "2020-01-01", to: "2020-12-31" });
  const custom = { from: "2025-12-30", to: "2026-01-02" };
  assert.deepEqual(periodRange("custom", custom, "2026-09-23"), custom);
});

test("intervalos impossíveis, incompletos, invertidos e maiores que 12 anos não retornam dados", () => {
  for (const range of [
    blank,
    { from: "2026-02-29", to: "2026-03-01" },
    { from: "2026-09-24", to: "2026-09-23" },
    { from: "2026-9-01", to: "2026-09-30" },
    { from: "2014-01-01", to: "2026-12-31" },
  ]) {
    assert.deepEqual(periodYears(range), []);
    assert.deepEqual(filterFpyEntries(entries, { ...filters, ...range }, false), []);
  }
  assert.equal(periodYears({ from: "2015-01-01", to: "2026-12-31" }).length, 12);
});

test("busca de contexto conserva produção e todos os defeitos para calcular FPY", () => {
  const result = filterFpyEntries(entries, { ...filters, search: "  MODULO  " }, false);
  assert.equal(result.length, 3);
  const [group] = summarize(result);
  assert.equal(group.production, 100);
  assert.equal(group.defects, 5);
  assert.equal(group.fpy, 95);
  assert.deepEqual(filterFpyEntries(entries, { ...filters, search: "A01" }, false), []);
});

test("busca de defeitos encontra descrição sem acentos, código e posição", () => {
  for (const search of ["  CONTAMINACAO ", "a01", "c1"])
    assert.deepEqual(filterFpyEntries(entries, { ...filters, search }, true).map((entry) => entry.id), ["defect-1"]);
});

test("nomes de modelo divergentes no mesmo contexto não alteram o cálculo de FPY", () => {
  const records = [
    { ...entries[0], model: "Módulo novo" },
    { ...entries[1], model: "Módulo anterior" },
    { ...entries[2], model: "Módulo anterior" },
    { ...base, id: "other-context", date: "2026-09-24", model: "Outro modelo" },
  ];
  for (const search of ["modulo novo", "modulo anterior"]) {
    const selected = filterFpyEntries(records, { ...filters, search }, false);
    assert.deepEqual(selected.map((entry) => entry.id), ["production-1", "defect-1", "defect-2"]);
    const [group] = summarize(selected);
    assert.equal(group.production, 100);
    assert.equal(group.defects, 5);
    assert.equal(group.fpy, 95);
  }
  assert.deepEqual(
    filterFpyEntries(records, { ...filters, search: "a01" }, true).map((entry) => entry.id),
    ["defect-1"],
  );
});

test("data inclusiva, linha e turno são aplicados em conjunto", () => {
  const records = [
    base,
    { ...base, id: "second-shift", shift: "2" },
    { ...base, id: "other-line", line: "SMT-2" },
    { ...base, id: "previous-day", date: "2026-09-22" },
    { ...base, id: "following-day", date: "2026-09-24" },
  ];
  const selected = filterFpyEntries(records, {
    ...filters, from: "2026-09-23", to: "2026-09-23", shift: "1", line: " smt-1 ",
  }, false);
  assert.deepEqual(selected.map((entry) => entry.id), ["production-1"]);
});
