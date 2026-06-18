import { requireAdmin } from "@/lib/server/requireAdmin";
import { importLegacyPortalMembers } from "@/lib/server/legacyPortalSync";

export async function POST(request: Request) {
  const { user, response } = await requireAdmin(request);

  if (!user) {
    return response;
  }

  try {
    const result = await importLegacyPortalMembers();

    if (
      (result.imported.students ?? 0) === 0 &&
      (result.imported.instructors ?? 0) === 0 &&
      ((result.skipped.students ?? 0) > 0 || (result.skipped.instructors ?? 0) > 0)
    ) {
      return Response.json(
        {
          error:
            result.errors.length > 0
              ? result.errors.join(" ")
              : "Legacy members were found, but NMAA rejected every import row.",
          result,
        },
        { status: 400 }
      );
    }

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to import Legacy members." },
      { status: 500 }
    );
  }
}
