import { cookies } from "next/headers";
import { checkOrigin, sessionCookie, failure } from "@/src/backend/application/access";
import { database } from "@/src/backend/infrastructure/database";
import { tokenHash } from "@/src/backend/infrastructure/passwords";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const token = (await cookies()).get("fpy_session")?.value;
    if (token)
      await database()
        .prepare("DELETE FROM sessions WHERE token=?")
        .bind(tokenHash(token))
        .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": sessionCookie(req, "signed-out"),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
