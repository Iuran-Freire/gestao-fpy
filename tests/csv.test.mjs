import test from "node:test";
import assert from "node:assert/strict";
import { createCsvExport } from "../src/application/csv.ts";

const entry = {
  id: "csv-test-1",
  kind: "defect",
  date: "2026-09-13",
  shift: "1",
  line: "SMT-1",
  pn: "24K0014-0",
  model: "MODEM; HGU",
  quantity: 2,
  code: "SMT09",
  description: 'Peça "deslocada"',
  position: "R204",
  station: "SMT PROCESS",
  category: "SMT",
  author: "Iuran Freire",
  createdAt: "",
  updatedAt: "",
  revision: 1,
};

test("CSV exporta a aba e os registros filtrados com formato do Excel", () => {
  const result = createCsvExport(
    "defects",
    [entry],
    [],
    new Set([entry.id]),
    "2026",
  );
  assert.equal(result.filename, "defeitos_2026.csv");
  assert.match(result.content, /"MODEM; HGU"/);
  assert.match(result.content, /"Peça ""deslocada"""/);
  assert.match(result.content, /"Pendente"/);
  assert.equal(result.content.split("\r\n").length, 2);
});

test("CSV neutraliza fórmulas inseridas em campos de texto", () => {
  const result = createCsvExport(
    "defects",
    [{ ...entry, model: "=1+1" }],
    [],
    new Set(),
    "2026",
  );
  assert.match(result.content, /"'=1\+1"/);
});
