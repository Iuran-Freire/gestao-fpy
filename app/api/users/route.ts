import {
  currentUser,
  failure,
  HttpError,
  checkOrigin,
} from "@/src/application/access";
import { database } from "@/src/infrastructure/database";
export async function GET() {
  try {
    const u = await currentUser();
    if (!u.owner)
      throw new HttpError(
        403,
        "Apenas o responsável pelo sistema gerencia acessos.",
      );
    return Response.json(
      (await database().prepare("SELECT * FROM users ORDER BY name").all())
        .results,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u.owner) throw new HttpError(403, "Sem permissão.");
    const { id, role } = (await req.json()) as { id: string; role: string };
    if (
      !["operador", "supervisor", "lider", "tecnica"].includes(role) ||
      typeof id !== "string"
    )
      throw new HttpError(400, "Perfil inválido.");
    await database()
      .prepare("UPDATE users SET role=? WHERE id=? AND owner=0")
      .bind(role, id)
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
