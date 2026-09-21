import { currentUser, checkOrigin, canManageUsers, HttpError, failure } from "@/src/backend/application/access";
import { database } from "@/src/backend/infrastructure/database";
import { validateCatalog, type CatalogItem } from "@/src/shared/domain/catalog";
import { canCorrect } from "@/src/shared/domain/fpy";

const columns = "id,kind,code,label,internal,class_cc AS classCc,station,sector,category,active,revision";
export async function GET() {
  try {
    await currentUser();
    const data = await database().prepare(`SELECT ${columns} FROM catalog ORDER BY kind,code,sector,station`).all<CatalogItem>();
    return Response.json(data.results, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (!canManageUsers(user) && !canCorrect(user.role)) throw new HttpError(403, "Somente a gestão pode alterar os cadastros.");
    let item: CatalogItem;
    try { item = validateCatalog(await req.json()); }
    catch (e) { throw new HttpError(400, (e as Error).message); }
    const db = database();
    const now = new Date().toISOString();
    try {
      if (item.revision === 0) {
        await db.prepare("INSERT INTO catalog(id,kind,code,label,internal,class_cc,station,sector,category,active,revision,changed_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)")
          .bind(item.id,item.kind,item.code,item.label,item.internal,item.classCc,item.station,item.sector,item.category,item.active,user.id,now).run();
      } else {
        const result = await db.prepare("UPDATE catalog SET code=?,label=?,internal=?,class_cc=?,station=?,sector=?,category=?,active=?,revision=revision+1,changed_by=?,updated_at=? WHERE id=? AND kind=? AND revision=?")
          .bind(item.code,item.label,item.internal,item.classCc,item.station,item.sector,item.category,item.active,user.id,now,item.id,item.kind,item.revision).run();
        if (!result.meta.changes) throw new HttpError(409, "Cadastro alterado por outra pessoa. Atualize a lista e tente novamente.");
      }
    } catch (e) {
      if (/UNIQUE constraint/.test(String(e))) throw new HttpError(409, "PN já cadastrado ou código de defeito já existente neste setor e estação. Confira também os inativos.");
      throw e;
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
