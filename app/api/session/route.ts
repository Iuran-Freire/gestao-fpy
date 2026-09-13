import { currentUser, failure } from "@/src/application/access";
export async function GET() {
  try {
    return Response.json(await currentUser(true), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
