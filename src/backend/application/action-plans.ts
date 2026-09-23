import { database } from "@/src/backend/infrastructure/database";
import { canStartActionPlan, canTreatActionPlan, validateActionPlan, type ActionPlan } from "@/src/shared/domain/action-plan";
import type { User } from "@/src/shared/domain/fpy";
import { HttpError } from "./access";

export const actionPlanColumns = "id,record_id AS recordId,evidence,containment,root_cause AS rootCause,corrective_action AS correctiveAction,responsible,due_date AS dueDate,status,quality_by AS qualityBy,quality_at AS qualityAt,engineering_by AS engineeringBy,engineering_at AS engineeringAt,updated_at AS updatedAt,revision";

export async function listActionPlans(year: string) {
  return database().prepare(`SELECT ${actionPlanColumns.replaceAll(",", ",p.").replace("id", "p.id")} FROM action_plans p JOIN records r ON r.id=p.record_id WHERE r.date>=? AND r.date<? ORDER BY p.updated_at DESC`)
    .bind(`${year}-01-01`, `${Number(year) + 1}-01-01`).all<ActionPlan>();
}

export async function saveActionPlan(input: unknown, user: User) {
  let plan: ActionPlan;
  try { plan = validateActionPlan(input); }
  catch (error) { throw new HttpError(400, (error as Error).message); }
  const db = database();
  const record = await db.prepare("SELECT kind FROM records WHERE id=?").bind(plan.recordId).first<{ kind: string }>();
  if (!record || record.kind !== "defect") throw new HttpError(404, "Lançamento de defeito não encontrado.");
  const existing = await db.prepare(`SELECT ${actionPlanColumns} FROM action_plans WHERE record_id=?`).bind(plan.recordId).first<ActionPlan>();
  const now = new Date().toISOString();
  if (!existing) {
    if (!canStartActionPlan(user)) throw new HttpError(403, "Somente a Qualidade pode iniciar um plano de ação.");
    if (plan.revision !== 0) throw new HttpError(409, "Atualize os dados e tente novamente.");
    if (plan.status !== "open" || plan.containment || plan.rootCause || plan.correctiveAction || plan.responsible || plan.dueDate)
      throw new HttpError(400, "A Qualidade deve registrar somente a evidência inicial.");
    await db.prepare("INSERT INTO action_plans(id,record_id,evidence,containment,root_cause,corrective_action,responsible,due_date,status,quality_by,quality_at,engineering_by,engineering_at,updated_at,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)")
      .bind(plan.id,plan.recordId,plan.evidence,"","","","","","open",user.name,now,"","",now).run();
  } else {
    if (!canTreatActionPlan(user)) throw new HttpError(403, "Somente a Engenharia pode tratar e fechar um plano de ação.");
    if (existing.status === "completed") throw new HttpError(409, "Este plano já foi concluído.");
    if (plan.evidence !== existing.evidence) throw new HttpError(400, "A evidência registrada pela Qualidade não pode ser alterada pela Engenharia.");
    if (plan.status === "open") throw new HttpError(400, "Salve o tratamento como em andamento ou conclua o plano.");
    if (existing.revision !== plan.revision) throw new HttpError(409, "Este plano foi alterado por outra pessoa. Reabra e tente novamente.");
    const result = await db.prepare("UPDATE action_plans SET evidence=?,containment=?,root_cause=?,corrective_action=?,responsible=?,due_date=?,status=?,engineering_by=?,engineering_at=?,updated_at=?,revision=revision+1 WHERE record_id=? AND revision=?")
      .bind(existing.evidence,plan.containment,plan.rootCause,plan.correctiveAction,plan.responsible,plan.dueDate,plan.status,user.name,now,now,plan.recordId,plan.revision).run();
    if (!result.meta.changes) throw new HttpError(409, "Este plano foi alterado por outra pessoa. Reabra e tente novamente.");
  }
  return db.prepare(`SELECT ${actionPlanColumns} FROM action_plans WHERE record_id=?`).bind(plan.recordId).first<ActionPlan>();
}
