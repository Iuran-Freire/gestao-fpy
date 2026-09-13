import { currentUser, failure, HttpError } from "@/src/application/access";
import { database } from "@/src/infrastructure/database";
export async function GET(req: Request) {
  try {
    const u = await currentUser();
    if (u.role === "operador")
      throw new HttpError(403, "Sem permissão para histórico de correções.");
    const id = new URL(req.url).searchParams.get("id");
    return Response.json(
      (
        await database()
          .prepare(
            "SELECT * FROM audit WHERE record_id=? ORDER BY id DESC LIMIT 100",
          )
          .bind(id)
          .all()
      ).results,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
