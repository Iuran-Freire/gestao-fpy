import {
  currentUser,
  checkOrigin,
  failure,
  HttpError,
} from "@/src/backend/application/access";
import { createBackup } from "@/src/backend/application/backups";
import { bucket } from "@/src/backend/infrastructure/database";
export async function GET(req: Request) {
  try {
    const u = await currentUser();
    if (!u.owner) throw new HttpError(403, "Sem permissão.");
    const date = new URL(req.url).searchParams.get("date");
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new HttpError(400, "Data inválida.");
      const storage = bucket(),
        object = await storage.get("backups/" + date + "/manifest.json");
      if (!object) throw new HttpError(404, "Backup não encontrado.");
      const manifest = await object.json<{
        files: string[];
        version: number;
        date: string;
      }>();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "manifest", ...manifest }) + "\n",
              ),
            );
            for (const key of manifest.files) {
              const part = await storage.get(key);
              if (!part) throw Error("Backup incompleto.");
              const rows = await part.json<unknown[]>();
              const table = key
                .split("/")
                .at(-1)!
                .replace(/-\d+\.json$/, "");
              for (const row of rows)
                controller.enqueue(
                  encoder.encode(JSON.stringify({ table, row }) + "\n"),
                );
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": `attachment; filename="fpy-backup-${date}.ndjson"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const list = await bucket().list({ prefix: "backups/", limit: 1000 });
    return Response.json(
      {
        dates: list.objects
          .filter((o) => o.key.endsWith("/manifest.json"))
          .map((o) => o.key.slice(8, 18))
          .sort()
          .reverse(),
        retention: "12 meses",
        schedule: "manual",
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
    const u = await currentUser();
    if (!u.owner) throw new HttpError(403, "Sem permissão.");
    return Response.json(await createBackup());
  } catch (e) {
    return failure(e);
  }
}
