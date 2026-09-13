import { cookies } from "next/headers";
import { checkOrigin, sessionCookie, failure } from "@/src/application/access";
import { database } from "@/src/infrastructure/database";
import { tokenHash } from "@/src/infrastructure/passwords";
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
