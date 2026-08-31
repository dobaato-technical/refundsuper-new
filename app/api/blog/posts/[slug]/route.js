import { NextResponse } from "next/server";
import { getBlogPostBySlug } from "@/lib/server/blogQueries";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return NextResponse.json({ detail: "Post not found" }, { status: 404 });
  return NextResponse.json(post);
}
