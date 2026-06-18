import { requireAdmin } from "@/lib/server/requireAdmin";
import { importLegacyPortalMembers } from "@/lib/server/legacyPortalSync";

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  try {
    const result = await importLegacyPortalMembers();
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to import Legacy members." },
      { status: 500 }
    );
  }
}
