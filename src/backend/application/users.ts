import { database } from "@/src/backend/infrastructure/database";
import { passwordHash } from "@/src/backend/infrastructure/passwords";
import { HttpError, canManageUsers, publicUserColumns } from "./access";
import type { User } from "@/src/shared/domain/fpy";

type AccountPayload = Record<string, unknown>;

function accountPayload(input: unknown): AccountPayload {
  if (!input || typeof input !== "object")
    throw new HttpError(400, "Dados inválidos.");
  return input as AccountPayload;
}

export function validateAccount(input: unknown) {
  const body = accountPayload(input);
  const { name, username, email = "", role } = body;
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw new HttpError(400, "Informe o nome completo.");
  if (
    typeof username !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{2,49}$/i.test(username)
  )
    throw new HttpError(
      400,
      "Usuário: 3 a 50 letras, números, ponto, traço ou sublinhado.",
    );
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )
    throw new HttpError(400, "E-mail inválido.");
  if (
    typeof role !== "string" ||
    !["operador", "supervisor", "lider", "tecnica", "engenharia"].includes(role)
  )
    throw new HttpError(400, "Perfil inválido.");
  return {
    name: name.trim(),
    username: username.toLowerCase(),
    email: email.trim().toLowerCase(),
    role: role as User["role"],
    active: body.active === 0 ? 0 : 1,
  };
}
export function accountAudit(
  actor: string,
  target: string,
  action: string,
  before: unknown,
  after: unknown,
) {
  return database()
    .prepare(
      "INSERT INTO user_audit(target,actor,action,before,after,at) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      target,
      actor,
      action,
      JSON.stringify(before),
      JSON.stringify(after),
      new Date().toISOString(),
    );
}
export async function manageAccount(input: unknown, actor: User) {
  const db = database();
  const body = accountPayload(input);
  const action = body.action;
  if (
    typeof action !== "string" ||
    !["create", "update", "reset"].includes(action)
  )
    throw new HttpError(400, "Ação inválida.");
  const target =
    action === "create"
      ? null
      : await db
          .prepare(`SELECT ${publicUserColumns} FROM users u WHERE id=?`)
          .bind(typeof body.id === "string" ? body.id : "")
          .first<User>();
  if (action !== "create" && !target)
    throw new HttpError(404, "Usuário não encontrado.");
  const self = target?.id === actor.id;
  if (!canManageUsers(actor) && !(self && action === "update"))
    throw new HttpError(403, "Sem permissão para gerenciar usuários.");
  if (target?.owner && !self)
    throw new HttpError(
      403,
      "A conta principal só pode ser editada pelo próprio administrador.",
    );
  if (!actor.owner && !self && target?.role !== "operador" && target)
    throw new HttpError(
      403,
      "Somente o administrador principal altera perfis de gestão.",
    );
  if (action === "reset") {
    if (!canManageUsers(actor)) throw new HttpError(403, "Sem permissão.");
    if (typeof body.password !== "string")
      throw new HttpError(400, "Informe uma senha.");
    let hash: string;
    try {
      hash = passwordHash(body.password);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    await db.batch([
      db
        .prepare(
          "INSERT INTO credentials(user_id,hash,must_change) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,must_change=1",
        )
        .bind(target!.id, hash),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(target!.id),
      accountAudit(actor.id, target!.id, "password_reset", null, {
        mustChange: true,
      }),
    ]);
    return { ok: true };
  }
  const data = validateAccount(body);
  if (!actor.owner && data.role !== (target?.role || "operador"))
    throw new HttpError(
      403,
      "Somente o administrador principal altera níveis de acesso.",
    );
  if (self && (data.active !== 1 || data.role !== actor.role))
    throw new HttpError(
      400,
      "Você não pode desativar ou reduzir o próprio acesso.",
    );
  const id = target?.id || crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (target) {
    const revision = body.revision;
    if (!Number.isInteger(revision) || revision !== target.revision)
      throw new HttpError(
        409,
        "Usuário atualizado por outra pessoa. Recarregue a lista.",
      );
    statements.push(
      db
        .prepare(
          "UPDATE users SET name=?,username=?,email=?,role=?,active=?,revision=? WHERE id=?",
        )
        .bind(
          data.name,
          data.username,
          data.email,
          data.role,
          data.active,
          (revision as number) + 1,
          id,
        ),
    );
  } else {
    if (typeof body.password !== "string")
      throw new HttpError(400, "Informe uma senha.");
    let hash: string;
    try {
      hash = passwordHash(body.password);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    statements.push(
      db
        .prepare(
          "INSERT INTO users(id,name,username,email,role,active,owner,revision) VALUES(?,?,?,?,?,?,0,1)",
        )
        .bind(id, data.name, data.username, data.email, data.role, data.active),
      db
        .prepare(
          "INSERT INTO credentials(user_id,hash,must_change) VALUES(?,?,1)",
        )
        .bind(id, hash),
    );
  }
  statements.push(
    db.prepare("DELETE FROM login_handles WHERE user_id=?").bind(id),
    db
      .prepare("INSERT INTO login_handles(handle,user_id) VALUES(?,?)")
      .bind(data.username, id),
  );
  if (data.email)
    statements.push(
      db
        .prepare("INSERT INTO login_handles(handle,user_id) VALUES(?,?)")
        .bind(data.email, id),
    );
  if (target && target.active !== data.active)
    statements.push(
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id),
    );
  statements.push(accountAudit(actor.id, id, action, target, data));
  try {
    await db.batch(statements);
  } catch (e) {
    if (/UNIQUE|revision_conflict/.test(String(e)))
      throw new HttpError(
        409,
        "Usuário/e-mail já cadastrado ou cadastro alterado. Recarregue a lista.",
      );
    throw e;
  }
  return { ok: true, id };
}
