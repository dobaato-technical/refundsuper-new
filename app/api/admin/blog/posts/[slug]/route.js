import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { slug } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("blog_posts").delete().eq("slug", slug).select("slug");
  if (error) return NextResponse.json({ detail: "Failed to delete post" }, { status: 500 });
  if (!data || !data.length) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
