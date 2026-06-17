import "server-only";

import { hasAdminAccess } from "@/lib/server/auth";
import { requireUser } from "@/lib/server/requireUser";

export async function requireAdmin(request: Request) {
  const { user, response } = await requireUser(request);

  if (!user) {
    return { user: null, response };
  }

  if (!hasAdminAccess(user.profile.role)) {
    return {
      user: null,
      response: Response.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { user, response: null };
}
