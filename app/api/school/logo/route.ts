import { requireApprovedUser } from "@/lib/server/access";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxLogoSize = 3 * 1024 * 1024;
const logoBucket = "school-logos";

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const { user, response } = await requireApprovedUser(request);

  if (!user) {
    return response;
  }

  if (user.profile.role !== "school_owner" || !user.profile.school_id) {
    return Response.json({ error: "Only linked school owners can upload a school logo." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const logo = formData?.get("logo");

  if (!(logo instanceof File)) {
    return Response.json({ error: "Choose a logo image to upload." }, { status: 400 });
  }

  if (!allowedLogoTypes.has(logo.type)) {
    return Response.json({ error: "Logo must be a PNG, JPG, or WebP image." }, { status: 400 });
  }

  if (logo.size > maxLogoSize) {
    return Response.json({ error: "Logo must be smaller than 3MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const extension = extensionForType(logo.type);
  const path = `${user.profile.school_id}/logo.${extension}`;
  const bytes = await logo.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(logoBucket).upload(path, bytes, {
    cacheControl: "3600",
    contentType: logo.type,
    upsert: true,
  });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabase.storage.from(logoBucket).getPublicUrl(path);
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { data, error } = await supabase
    .from("schools")
    .update({ logo_url: logoUrl })
    .eq("id", user.profile.school_id)
    .select("id,province_id,name,registration_number,city,address,contact_email,contact_phone,logo_url,affiliation_status,provinces(name,code)")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ school: data, logo_url: logoUrl });
}
