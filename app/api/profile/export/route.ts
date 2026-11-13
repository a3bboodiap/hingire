import { NextResponse } from "next/server";
import { requireSession, Unauthenticated } from "@/lib/auth";
import { fail, ERR } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** GDPR: self-service data export. Everything we hold about the caller. */
export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch (e) {
    if (e instanceof Unauthenticated) return fail(401, ERR.unauthenticated);
    return fail(500, ERR.server);
  }

  const { data, error } = await session.supabase.rpc("export_my_data");
  if (error) return fail(500, "Could not build your export.");

  await audit("data_exported", session.user.id, {});

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="hingire-my-data-${
        new Date().toISOString().slice(0, 10)
      }.json"`,
    },
  });
}
