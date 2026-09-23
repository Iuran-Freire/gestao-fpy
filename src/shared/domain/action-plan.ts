import type { User } from "./fpy";

export type ActionPlanStatus = "open" | "in_progress" | "completed";

export type ActionPlan = {
  id: string;
  recordId: string;
  evidence: string;
  containment: string;
  rootCause: string;
  correctiveAction: string;
  responsible: string;
  dueDate: string;
  status: ActionPlanStatus;
  qualityBy: string;
  qualityAt: string;
  engineeringBy: string;
  engineeringAt: string;
  updatedAt: string;
  revision: number;
};

export function canStartActionPlan(user: Pick<User, "role" | "owner">) {
  return user.owner === 1 || ["qualidade", "supervisor", "lider", "tecnica"].includes(user.role);
}

export function canTreatActionPlan(user: Pick<User, "role" | "owner">) {
  return user.owner === 1 || ["engenharia", "supervisor", "lider", "tecnica"].includes(user.role);
}

export function validateActionPlan(input: unknown): ActionPlan {
  if (!input || typeof input !== "object") throw Error("Plano de ação inválido.");
  const plan = { ...input } as ActionPlan;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(plan.id) || !/^[a-zA-Z0-9-]{8,80}$/.test(plan.recordId))
    throw Error("Identificação do plano de ação inválida.");
  for (const key of ["evidence", "containment", "rootCause", "correctiveAction"] as const) {
    if (typeof plan[key] !== "string" || plan[key].length > 4000) throw Error("Texto do plano de ação inválido.");
    plan[key] = plan[key].trim();
  }
  if (!plan.evidence) throw Error("Informe a evidência inicial do defeito.");
  for (const key of ["responsible", "qualityBy", "engineeringBy"] as const) {
    if (typeof plan[key] !== "string" || plan[key].length > 160) throw Error("Responsável inválido.");
    plan[key] = plan[key].trim();
  }
  if (plan.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(plan.dueDate)) throw Error("Prazo inválido.");
  if (!["open", "in_progress", "completed"].includes(plan.status)) throw Error("Situação inválida.");
  if (plan.status === "completed" && (!plan.containment || !plan.rootCause || !plan.correctiveAction || !plan.responsible || !plan.dueDate))
    throw Error("Preencha contenção, causa raiz, ação corretiva, responsável e prazo antes de fechar o plano.");
  if (!Number.isSafeInteger(plan.revision) || plan.revision < 0) throw Error("Revisão inválida.");
  return plan;
}
