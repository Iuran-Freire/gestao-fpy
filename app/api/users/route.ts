import {
  currentUser,
  failure,
  HttpError,
  checkOrigin,
  canManageUsers,
  publicUserColumns,
} from "@/src/backend/application/access";
import { database } from "@/src/backend/infrastructure/database";
import { manageAccount } from "@/src/backend/application/users";
export async function GET(req: Request) {
  try {
    const u = await currentUser();
    if (!canManageUsers(u)) throw new HttpError(403, "Sem permissão.");
    const id = new URL(req.url).searchParams.get("history");
    if (id) {
      return Response.json(
        (
          await database()
            .prepare(
              "SELECT a.*,u.name AS actor_name FROM user_audit a LEFT JOIN users u ON u.id=a.actor WHERE target=? ORDER BY a.id DESC LIMIT 50",
            )
            .bind(id)
            .all()
        ).results,
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      (
        await database()
          .prepare(
            `SELECT ${publicUserColumns},c.user_id IS NOT NULL AS hasPassword FROM users u LEFT JOIN credentials c ON c.user_id=u.id ORDER BY u.active DESC,u.name`,
          )
          .all()
      ).results,
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
    return Response.json(await manageAccount(await req.json(), u), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
