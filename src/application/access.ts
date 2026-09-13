import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/src/infrastructure/database";
import type { User } from "@/src/domain/fpy";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser(): Promise<User> {
  const identity = await getChatGPTUser();
  if (!identity)
    throw new HttpError(401, "Entre com sua conta para continuar.");
  const db = database();
  // The initial site is owner-private. Only its owner can bootstrap the application.
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO ownership (id,user_id) VALUES (1,?)")
      .bind(identity.userId),
    db
      .prepare(
        "INSERT OR IGNORE INTO users(id,email,name,role,owner) SELECT ?,?,?,CASE WHEN user_id=? THEN 'supervisor' ELSE 'operador' END,CASE WHEN user_id=? THEN 1 ELSE 0 END FROM ownership WHERE id=1",
      )
      .bind(
        identity.userId,
        identity.email,
        identity.displayName,
        identity.userId,
        identity.userId,
      ),
  ]);
  const user = await db
    .prepare("SELECT * FROM users WHERE id=?")
    .bind(identity.userId)
    .first<User>();
  if (!user) throw new HttpError(403, "Acesso não autorizado.");
  return user;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Origem não autorizada.");
}
export function failure(e: unknown) {
  console.error(e);
  return Response.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : "Não foi possível concluir. Tente novamente.",
    },
    {
      status: e instanceof HttpError ? e.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
