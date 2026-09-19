import { database } from "@/src/backend/infrastructure/database";
import {
  canCorrect,
  validateEntry,
  groupKey,
  type Entry,
  type Mutation,
  type User,
} from "@/src/shared/domain/fpy";
import { HttpError } from "./access";
export const columns =
  "id,kind,date,shift,line,pn,model,quantity,code,description,position,station,category,class_cc AS classCc,author,created_at AS createdAt,updated_at AS updatedAt,revision";
export async function applyMutation(input: Mutation, user: User) {
  if (!input || !/^[-a-zA-Z0-9]{8,80}$/.test(input.id))
    throw new HttpError(400, "Identificação do envio inválida.");
  let e: Entry;
  try {
    e = validateEntry(input.entry);
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
  const db = database(),
    payload = JSON.stringify(input),
    prior = await db
      .prepare("SELECT user_id,payload FROM operations WHERE id=?")
      .bind(input.id)
      .first<{ user_id: string; payload: string }>();
  if (prior) {
    if (prior.user_id !== user.id || prior.payload !== payload)
      throw new HttpError(409, "Identificação já usada por outro envio.");
    return { ok: true, replayed: true };
  }
  const now = new Date().toISOString(),
    existing = await db
      .prepare(`SELECT ${columns} FROM records WHERE id=?`)
      .bind(e.id)
      .first<Entry>();
  let statement: D1PreparedStatement;
  if (input.expectedRevision !== undefined) {
    if (!canCorrect(user.role))
      throw new HttpError(
        403,
        "Somente supervisor, líder ou técnica pode corrigir.",
      );
    if (!existing || existing.revision !== input.expectedRevision)
      throw new HttpError(
        409,
        "Registro atualizado por outra pessoa. Sincronize e refaça a correção.",
      );
    if (existing.kind !== e.kind)
      throw new HttpError(400, "Tipo do registro não pode mudar.");
    if (!input.reason?.trim() || input.reason.length > 300)
      throw new HttpError(400, "Informe o motivo da correção.");
    statement = db
      .prepare(
        "UPDATE records SET group_key=?,date=?,shift=?,line=?,pn=?,model=?,quantity=?,code=?,description=?,position=?,station=?,category=?,class_cc=?,updated_at=?,revision=?,changed_by=?,reason=? WHERE id=?",
      )
      .bind(
        groupKey(e),
        e.date,
        e.shift,
        e.line,
        e.pn,
        e.model,
        e.quantity,
        e.code,
        e.description,
        e.position,
        e.station,
        e.category,
        e.classCc || "",
        now,
        input.expectedRevision + 1,
        user.name,
        input.reason.trim(),
        e.id,
      );
  } else {
    if (existing)
      throw new HttpError(409, "Este registro já existe. Sincronize os dados.");
    statement = db
      .prepare(
        "INSERT INTO records(id,kind,group_key,date,shift,line,pn,model,quantity,code,description,position,station,category,class_cc,author,created_at,updated_at,revision,changed_by,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        e.id,
        e.kind,
        groupKey(e),
        e.date,
        e.shift,
        e.line,
        e.pn,
        e.model,
        e.quantity,
        e.code,
        e.description,
        e.position,
        e.station,
        e.category,
        e.classCc || "",
        user.name,
        now,
        now,
        1,
        user.name,
        "Lançamento inicial",
      );
  }
  try {
    await db.batch([
      statement,
      db
        .prepare(
          "INSERT INTO operations(id,user_id,payload,created_at) VALUES (?,?,?,?)",
        )
        .bind(input.id, user.id, payload, now),
    ]);
  } catch (err) {
    const message = String(err);
    if (/UNIQUE|revision_conflict/.test(message))
      throw new HttpError(
        409,
        "Produção já informada ou registro alterado. Sincronize e solicite uma correção.",
      );
    throw err;
  }
  return { ok: true };
}
