import { checkOrigin, currentUser, failure, HttpError } from "@/src/backend/application/access";
import { database } from "@/src/backend/infrastructure/database";
import { canCorrect } from "@/src/shared/domain/fpy";
import { validateActionPlan, type ActionPlan } from "@/src/shared/domain/pqc";

const columns = `p.id,p.date,p.shift,p.line,p.pn,p.model,p.quantity,p.defect_code AS defectCode,
 p.defect_description AS defectDescription,p.category,p.position,p.evidence,p.containment,
 p.root_cause AS rootCause,p.corrective_action AS correctiveAction,p.verification,p.responsible,
 p.due_date AS dueDate,p.status,p.opened_by AS openedBy,op.name AS openedByName,
 p.engineering_by AS engineeringBy,en.name AS engineeringByName,p.created_at AS createdAt,
 p.updated_at AS updatedAt,p.completed_at AS completedAt,p.revision`;

export async function GET(req: Request) {
  try {
    await currentUser();
    const history = new URL(req.url).searchParams.get("history");
    if (history) {
      const data = await database().prepare("SELECT a.id,a.actor,u.name AS actorName,a.before,a.after,a.at FROM action_plan_audit a LEFT JOIN users u ON u.id=a.actor WHERE a.plan_id=? ORDER BY a.id DESC LIMIT 100").bind(history).all();
      return Response.json(data.results, { headers: { "Cache-Control": "no-store" } });
    }
    const data = await database().prepare(`SELECT ${columns} FROM action_plans p LEFT JOIN users op ON op.id=p.opened_by LEFT JOIN users en ON en.id=p.engineering_by ORDER BY CASE p.status WHEN 'aberto' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END,p.date DESC,p.updated_at DESC LIMIT 1000`).all<ActionPlan>();
    return Response.json(data.results, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (!canCorrect(user.role) && !user.owner) throw new HttpError(403, "Somente Qualidade, liderança, supervisão ou Engenharia podem alterar planos de ação.");
    const body = await req.json() as ActionPlan;
    const db = database();
    const now = new Date().toISOString();
    const previous = body.revision ? await db.prepare(`SELECT ${columns} FROM action_plans p LEFT JOIN users op ON op.id=p.opened_by LEFT JOIN users en ON en.id=p.engineering_by WHERE p.id=?`).bind(body.id).first<ActionPlan>() : null;
    let plan: ActionPlan;
    try { plan = validateActionPlan({ ...body, status: body.status || "aberto" }, previous || undefined); }
    catch (e) { throw new HttpError(400, (e as Error).message); }
    if (!previous) {
      await db.batch([
        db.prepare("INSERT INTO action_plans(id,date,shift,line,pn,model,quantity,defect_code,defect_description,category,position,evidence,containment,root_cause,corrective_action,verification,responsible,due_date,status,opened_by,engineering_by,created_at,updated_at,completed_at,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)")
          .bind(plan.id,plan.date,plan.shift,plan.line,plan.pn,plan.model,plan.quantity,plan.defectCode,plan.defectDescription,plan.category,plan.position,plan.evidence,"","","","","","","aberto",user.id,null,now,now,null),
        db.prepare("INSERT INTO action_plan_audit(plan_id,actor,before,after,at) VALUES(?,?,NULL,?,?)").bind(plan.id,user.id,JSON.stringify({ ...plan,status:"aberto",openedBy:user.id,revision:1 }),now),
      ]);
      return Response.json({ ok: true, id: plan.id }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.revision !== previous.revision) throw new HttpError(409, "Plano alterado por outra pessoa. Atualize a lista.");
    const completedAt = plan.status === "concluido" ? (previous.completedAt || now) : null;
    const result = await db.prepare("UPDATE action_plans SET containment=?,root_cause=?,corrective_action=?,verification=?,responsible=?,due_date=?,status=?,engineering_by=?,updated_at=?,completed_at=?,revision=revision+1 WHERE id=? AND revision=?")
      .bind(plan.containment,plan.rootCause,plan.correctiveAction,plan.verification,plan.responsible,plan.dueDate,plan.status,user.id,now,completedAt,plan.id,previous.revision).run();
    if (!result.meta.changes) throw new HttpError(409, "Plano alterado por outra pessoa. Atualize a lista.");
    await db.prepare("INSERT INTO action_plan_audit(plan_id,actor,before,after,at) VALUES(?,?,?,?,?)").bind(plan.id,user.id,JSON.stringify(previous),JSON.stringify({ ...plan,engineeringBy:user.id,updatedAt:now,completedAt,revision:previous.revision+1 }),now).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
