import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { canStartActionPlan, canTreatActionPlan, validateActionPlan } from "../../src/shared/domain/action-plan.ts";

function migrated() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const migrations = new URL("../../src/backend/database/migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(file, migrations), "utf8"));
  return db;
}
const plan = { id: "plan-0001", recordId: "record-0001", evidence: "Falha visual", containment: "", rootCause: "", correctiveAction: "", responsible: "", dueDate: "", status: "open", qualityBy: "", qualityAt: "", engineeringBy: "", engineeringAt: "", updatedAt: "", revision: 0 };

test("plano de ação exige evidência e aceita o fluxo em duas etapas", () => {
  assert.equal(validateActionPlan(plan).evidence, "Falha visual");
  assert.throws(() => validateActionPlan({ ...plan, evidence: "" }), /evidência/);
  assert.throws(() => validateActionPlan({ ...plan, status: "duplicado" }), /Situação/);
  assert.throws(() => validateActionPlan({ ...plan, status: "completed" }), /Preencha contenção/);
  assert.equal(validateActionPlan({ ...plan, status: "completed", containment: "Bloqueio", rootCause: "Montagem", correctiveAction: "Revisar instrução", responsible: "Engenharia", dueDate: "2026-10-01" }).status, "completed");
});

test("Qualidade inicia e Engenharia trata o plano", () => {
  assert.equal(canStartActionPlan({ role: "qualidade", owner: 0 }), true);
  assert.equal(canTreatActionPlan({ role: "qualidade", owner: 0 }), false);
  assert.equal(canStartActionPlan({ role: "engenharia", owner: 0 }), false);
  assert.equal(canTreatActionPlan({ role: "engenharia", owner: 0 }), true);
  assert.equal(canStartActionPlan({ role: "operador", owner: 1 }), true);
  assert.equal(canTreatActionPlan({ role: "operador", owner: 1 }), true);
});

test("cada defeito admite somente um plano de ação", () => {
  const db = migrated();
  db.prepare("INSERT INTO records(id,kind,group_key,date,shift,line,pn,model,quantity,code,description,position,station,category,class_cc,author,created_at,updated_at,revision,changed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("record-0001","defect","g","2026-09-23","1","A","PN1","Modelo",1,"D1","Falha","U1","POSTO","ADAPTADOR","ADAPTADOR","QA","now","now",1,"QA");
  const insert = db.prepare("INSERT INTO action_plans(id,record_id,evidence,quality_by,quality_at,updated_at) VALUES(?,?,?,?,?,?)");
  insert.run("plan-0001","record-0001","Falha visual","QA","now","now");
  assert.throws(() => insert.run("plan-0002","record-0001","Repetido","QA","now","now"), /UNIQUE/);
  db.close();
});
