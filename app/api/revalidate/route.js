import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Backend-only endpoint the FastAPI service hits when a blog post is (re)published.
 * Guarded by a shared secret set in both backends' env as `REVALIDATE_SECRET`.
 *
 * Body: { paths: string[] }
 * Header: `x-revalidate-secret: <REVALIDATE_SECRET>`
 */
export async function POST(req) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "unconfigured" }, { status: 503 });
  }
  const provided = req.headers.get("x-revalidate-secret");
  if (provided !== secret) {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  let body = {};
  try { body = await req.json(); } catch (e) { /* empty body ok */ }
  const paths = Array.isArray(body.paths) && body.paths.length > 0
    ? body.paths
    : ["/", "/blog"];
  const revalidated = [];
  for (const p of paths) {
    try {
      revalidatePath(p);
      revalidated.push(p);
    } catch (e) {
      /* fall through — Next reports failure via response */
    }
  }
  return NextResponse.json({ ok: true, revalidated });
}
