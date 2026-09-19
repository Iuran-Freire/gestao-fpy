import test from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  totalFpy,
  validateEntry,
  isoWeek,
  groupKey,
  canCorrect,
} from "../src/shared/domain/fpy.ts";
const base = {
  id: "test-0001",
  kind: "production",
  date: "2026-09-13",
  shift: "1",
  line: "SMT-1",
  pn: "PN1",
  model: "Modelo teste",
  quantity: 100,
  code: "",
  description: "",
  position: "",
  station: "",
  category: "",
  author: "Teste",
  createdAt: "",
  updatedAt: "",
  revision: 1,
};
test("FPY soma defeitos e pondera grupos por produção", () => {
  const g = summarize([
    base,
    { ...base, id: "test-0002", kind: "defect", quantity: 5 },
    { ...base, id: "test-0003", kind: "defect", quantity: 3 },
    { ...base, id: "test-0004", pn: "PN2", quantity: 900 },
  ]);
  assert.equal(g[0].fpy, 92);
  assert.equal(totalFpy(g), 99.2);
});
test("sem produção e defeitos acima da produção não geram FPY enganoso", () => {
  assert.equal(
    totalFpy(summarize([{ ...base, kind: "defect", quantity: 5 }])),
    null,
  );
  const [g] = summarize([base, { ...base, kind: "defect", quantity: 101 }]);
  assert.equal(g.issue, true);
  assert.equal(g.fpy, null);
});
test("produção zero não divide por zero", () =>
  assert.equal(totalFpy(summarize([{ ...base, quantity: 0 }])), null));
test("datas impossíveis, frações e defeitos incompletos são recusados", () => {
  for (const e of [
    { ...base, date: "2026-02-30" },
    { ...base, quantity: 1.5 },
    { ...base, kind: "defect", quantity: 1 },
  ])
    assert.throws(() => validateEntry(e));
});
test("chave de produção normalizada e independente do código", () =>
  assert.equal(
    groupKey(base),
    groupKey({ ...base, line: " smt-1 ", pn: "pn1", code: "SMT09" }),
  ));
test("semana ISO na virada do ano", () =>
  assert.deepEqual(isoWeek("2021-01-01"), { year: 2020, week: 53 }));
test("somente perfis de correção autorizados", () => {
  assert.equal(canCorrect("operador"), false);
  for (const role of ["supervisor", "lider", "tecnica"])
    assert.equal(canCorrect(role), true);
});
