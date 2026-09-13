import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database } from "@/src/infrastructure/database";
import { sessionCookie } from "@/src/application/access";
export async function GET(req: Request) {
  const identity = await getChatGPTUser();
  if (!identity)
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/signin-with-chatgpt?return_to=/api/auth/recover-owner",
        "Cache-Control": "no-store",
      },
    });
  const owner = await database()
    .prepare("SELECT user_id FROM ownership WHERE id=1")
    .first<{ user_id: string }>();
  if (owner?.user_id !== identity.userId)
    return Response.json(
      { error: "A recuperação exige a conta original do administrador." },
      { status: 403 },
    );
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": sessionCookie(req, "", 0),
      "Cache-Control": "no-store",
    },
  });
}
