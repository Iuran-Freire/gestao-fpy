import { currentUser, failure } from "@/src/backend/application/access";
import { bucketAvailable } from "@/src/backend/infrastructure/database";
export async function GET() {
  try {
    return Response.json(
      {
        ...(await currentUser(true)),
        backupAvailable: bucketAvailable(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
