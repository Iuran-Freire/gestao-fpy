import {
  currentUser,
  failure,
  checkOrigin,
  HttpError,
} from "@/src/backend/application/access";
import { applyMutation, columns } from "@/src/backend/application/records";
import { database } from "@/src/backend/infrastructure/database";
export async function GET(req: Request) {
  try {
    await currentUser();
    const url = new URL(req.url),
      year =
        url.searchParams.get("year") || String(new Date().getUTCFullYear()),
      cursor = url.searchParams.get("cursor") || "";
    if (!/^\d{4}$/.test(year) || cursor.length > 120)
      throw new HttpError(400, "Ano ou cursor inválido.");
    const result = await database()
      .prepare(
        `SELECT ${columns} FROM records WHERE date>=? AND date<? AND (date || '|' || id)>? ORDER BY date,id LIMIT 1000`,
      )
      .bind(year + "-01-01", String(Number(year) + 1) + "-01-01", cursor)
      .all();
    const list = result.results as { id: string; date: string }[];
    return Response.json(
      {
        records: list,
        next:
          list.length === 1000
            ? list.at(-1)!.date + "|" + list.at(-1)!.id
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (Number(req.headers.get("content-length")) > 20000)
      throw new HttpError(413, "Envio muito grande.");
    return Response.json(await applyMutation(await req.json(), user));
  } catch (e) {
    return failure(e);
  }
}
