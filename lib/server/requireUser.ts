import "server-only";

import { getAuthenticatedUser } from "@/lib/server/auth";

export async function requireUser(request: Request) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return { user: null, response: Response.json({ error }, { status: 401 }) };
  }

  return { user, response: null };
}
