import { getChatGPTUser } from "@/src/backend/auth/chatgpt-auth";
import { cookies } from "next/headers";
import { database } from "@/src/backend/infrastructure/database";
import { tokenHash } from "@/src/backend/infrastructure/passwords";
import type { User } from "@/src/shared/domain/fpy";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const publicUserColumns =
  "u.id,u.name,u.email,u.role,u.owner,u.username,u.active,u.revision";
export async function currentUser(allowPasswordChange = false): Promise<User> {
  const db = database();
  const token = (await cookies()).get("fpy_session")?.value;
  let user: User | null = null;
  if (token) {
    if (token === "signed-out")
      throw new HttpError(401, "Entre com seu usuário e senha.");
    user = await db
      .prepare(
        `SELECT ${publicUserColumns} FROM users u JOIN sessions s ON s.user_id=u.id JOIN credentials c ON c.user_id=u.id AND c.hash=s.credential_hash WHERE s.token=? AND s.expires>? AND s.user_revision=u.revision`,
      )
      .bind(tokenHash(token), Date.now())
      .first<User>();
    if (!user) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  } else {
    const identity = await getChatGPTUser();
    if (!identity) throw new HttpError(401, "Entre com seu usuário e senha.");
    // Preserve the original owner recovery path. Other users authenticate with FPY credentials.
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO ownership(id,user_id) VALUES(1,?)")
        .bind(identity.userId),
      db
        .prepare(
          "INSERT OR IGNORE INTO users(id,email,name,role,owner) SELECT ?,?,?,'supervisor',1 FROM ownership WHERE id=1 AND user_id=?",
        )
        .bind(
          identity.userId,
          identity.email,
          identity.displayName,
          identity.userId,
        ),
    ]);
    user = await db
      .prepare(
        `SELECT ${publicUserColumns} FROM users u WHERE u.id=? AND u.owner=1`,
      )
      .bind(identity.userId)
      .first<User>();
    if (!user)
      throw new HttpError(401, "Entre com seu usuário e senha do FPY.");
  }
  if (user.active !== 1)
    throw new HttpError(403, "Usuário desativado. Procure o administrador.");
  const credential = await db
    .prepare("SELECT must_change FROM credentials WHERE user_id=?")
    .bind(user.id)
    .first<{ must_change: number }>();
  user.hasPassword = !!credential;
  user.mustChange = credential?.must_change === 1;
  if (user.mustChange && !allowPasswordChange)
    throw new HttpError(403, "Troque sua senha temporária antes de continuar.");
  return user;
}
export function canManageUsers(u: User) {
  return !!u.owner || ["supervisor", "lider", "tecnica"].includes(u.role);
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Origem não autorizada.");
}
export function failure(e: unknown) {
  if (!(e instanceof HttpError)) console.error("FPY request failed");
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
export function sessionCookie(req: Request, token: string, maxAge = 43200) {
  return `fpy_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
