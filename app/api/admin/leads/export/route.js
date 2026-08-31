import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ detail: "Export failed" }, { status: 500 });

  const docs = data || [];
  let csv;
  if (docs.length) {
    const fields = Object.keys(docs[0]);
    const lines = [fields.join(",")];
    for (const d of docs) lines.push(fields.map((f) => csvEscape(d[f])).join(","));
    csv = lines.join("\n") + "\n";
  } else {
    csv = "no_leads\n";
  }
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=refundmysuper_leads.csv",
    },
  });
}
