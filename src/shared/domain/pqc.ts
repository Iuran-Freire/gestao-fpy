export type ActionPlanStatus = "aberto" | "em_analise" | "concluido";

export type ActionPlan = {
  id: string;
  date: string;
  shift: string;
  line: string;
  pn: string;
  model: string;
  quantity: number;
  defectCode: string;
  defectDescription: string;
  category: string;
  position: string;
  evidence: string;
  containment: string;
  rootCause: string;
  correctiveAction: string;
  verification: string;
  responsible: string;
  dueDate: string;
  status: ActionPlanStatus;
  openedBy: string;
  openedByName?: string;
  engineeringBy?: string;
  engineeringByName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  revision: number;
};

type TextKey = "line" | "pn" | "model" | "defectCode" | "defectDescription" | "category" | "position" | "evidence" | "containment" | "rootCause" | "correctiveAction" | "verification" | "responsible";

export function validateActionPlan(input: unknown, existing?: ActionPlan): ActionPlan {
  if (!input || typeof input !== "object") throw Error("Plano de ação inválido.");
  const plan = { ...(existing || {}), ...input } as ActionPlan;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(plan.id)) throw Error("Identificação inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date) || !Number.isFinite(Date.parse(plan.date + "T12:00:00Z"))) throw Error("Data inválida.");
  if (!["1", "2", "3"].includes(plan.shift)) throw Error("Selecione o turno.");
  const textKeys: TextKey[] = ["line", "pn", "model", "defectCode", "defectDescription", "category", "position", "evidence", "containment", "rootCause", "correctiveAction", "verification", "responsible"];
  for (const key of textKeys) {
    if (typeof plan[key] !== "string" || plan[key].length > 4000) throw Error("Campo inválido: " + key);
    plan[key] = plan[key].trim();
  }
  plan.line = plan.line.toUpperCase();
  plan.pn = plan.pn.toUpperCase();
  plan.defectCode = plan.defectCode.toUpperCase();
  plan.position = plan.position.toUpperCase();
  if (!plan.line || !plan.pn || !plan.model || !plan.defectCode || !plan.defectDescription || !plan.category || !plan.evidence) throw Error("Preencha a identificação do defeito, a categoria e a evidência inicial.");
  if (!Number.isSafeInteger(plan.quantity) || plan.quantity < 1 || plan.quantity > 10000000) throw Error("Quantidade inválida.");
  if (!["aberto", "em_analise", "concluido"].includes(plan.status)) throw Error("Situação inválida.");
  if (plan.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(plan.dueDate)) throw Error("Prazo inválido.");
  if (plan.status === "concluido" && (!plan.rootCause || !plan.correctiveAction || !plan.verification || !plan.responsible || !plan.dueDate)) {
    throw Error("Para concluir, informe causa raiz, ação corretiva, verificação, responsável e prazo.");
  }
  return plan;
}
