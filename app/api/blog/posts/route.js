import { NextResponse } from "next/server";
import { listBlogPosts } from "@/lib/server/blogQueries";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const tag = searchParams.get("tag") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const result = await listBlogPosts({ category, tag, limit });
  return NextResponse.json(result);
}
