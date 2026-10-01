import test from "node:test";
import assert from "node:assert/strict";
import { validateActionPlan } from "../../src/shared/domain/pqc.ts";

const base = {
  id: "test-plan-0001", date: "2026-09-20", shift: "2", line: "smt-1", pn: "24K0015-0",
  model: "MODEM HGU", quantity: 2, defectCode: "smt09", defectDescription: "Componente deslocado",
  category: "SMT PROCESS", position: "r204", evidence: "Componente fora do pad na inspeção.",
  containment: "", rootCause: "", correctiveAction: "", verification: "", responsible: "", dueDate: "",
  status: "aberto", openedBy: "quality-user", createdAt: "", updatedAt: "", revision: 0,
};

test("PQC exige identificação, categoria e evidência da Qualidade", () => {
  const plan = validateActionPlan(base);
  assert.equal(plan.line, "SMT-1");
  assert.equal(plan.defectCode, "SMT09");
  assert.throws(() => validateActionPlan({ ...base, evidence: "" }), /evidência/);
  assert.throws(() => validateActionPlan({ ...base, category: "" }), /categoria/);
});

test("plano só pode ser concluído com análise e verificação", () => {
  assert.throws(() => validateActionPlan({ ...base, status: "concluido" }), /Para concluir/);
  assert.doesNotThrow(() => validateActionPlan({ ...base, status: "concluido", rootCause: "Alimentador desalinhado", correctiveAction: "Ajustar alimentador", verification: "Três lotes sem recorrência", responsible: "Engenharia SMT", dueDate: "2026-09-25" }));
});
