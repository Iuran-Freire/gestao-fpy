import { checkOrigin, currentUser, failure, HttpError } from "@/src/backend/application/access";
import { actionPlanColumns, listActionPlans, saveActionPlan } from "@/src/backend/application/action-plans";
import { database } from "@/src/backend/infrastructure/database";
import type { ActionPlan } from "@/src/shared/domain/action-plan";

export async function GET(req: Request) {
  try {
    await currentUser();
    const params = new URL(req.url).searchParams;
    const recordId = params.get("recordId") || "";
    const year = params.get("year") || "";
    if (!recordId && /^\d{4}$/.test(year))
      return Response.json((await listActionPlans(year)).results, { headers: { "Cache-Control": "no-store" } });
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(recordId)) throw new HttpError(400, "Identificação inválida.");
    const plan = await database().prepare(`SELECT ${actionPlanColumns} FROM action_plans WHERE record_id=?`).bind(recordId).first<ActionPlan>();
    return Response.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (Number(req.headers.get("content-length")) > 30000) throw new HttpError(413, "Envio muito grande.");
    return Response.json(await saveActionPlan(await req.json(), user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
