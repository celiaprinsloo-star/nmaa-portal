import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { roles } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const requestedRole = String(body.requested_role ?? "");

  if (!fullName || !email || password.length < 8 || !roles.includes(requestedRole as never)) {
    return Response.json({ error: "Please complete all registration fields." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, requested_role: requestedRole },
  });

  if (createError || !createdUser.user) {
    return Response.json(
      { error: createError?.message ?? "Unable to create user." },
      { status: 400 },
    );
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: createdUser.user.id,
    email,
    full_name: fullName,
    requested_role: requestedRole,
    role: null,
    approval_status: "pending",
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return Response.json({ error: profileError.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
