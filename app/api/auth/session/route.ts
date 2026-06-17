import { requireUser } from "@/lib/server/requireUser";

export async function GET(request: Request) {
  const { user, response } = await requireUser(request);

  if (!user) {
    return response;
  }

  return Response.json({
    user: { id: user.id, email: user.email },
    profile: user.profile,
  });
}
