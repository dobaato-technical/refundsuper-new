import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Clock, ArrowLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppChatButton from "@/components/WhatsAppChatButton";
import SEO from "@/components/SEO";
import BlogCTA from "@/components/BlogCTA";
import Comments from "@/components/Comments";
import BlogShareButton from "@/components/BlogShareButton";
import { Button } from "@/components/ui/button";
import { getBlogPostBySlug, listBlogPosts } from "@/lib/server/blogQueries";

const SITE_URL = process.env.REACT_APP_SITE_URL || "https://refundsuper.com.au";

const mdComponents = {
  h2: (p) => <h2 className="font-display text-3xl font-medium text-[#014E87] mt-10 mb-3 tracking-tight" {...p} />,
  h3: (p) => <h3 className="font-display text-2xl font-medium text-[#014E87] mt-8 mb-2 tracking-tight" {...p} />,
  p: (p) => <p className="text-[#014E87] leading-relaxed mb-4" {...p} />,
  a: (p) => <a className="text-[#014E87] hover:underline underline-offset-2" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="border-l-4 border-[#014E87] bg-[#EBF3FA] px-5 py-3 my-6 rounded-r-lg text-[#014E87] italic"
      {...p}
    />
  ),
  ul: (p) => <ul className="list-disc pl-6 space-y-2 mb-6 marker:text-[#014E87]" {...p} />,
  ol: (p) => <ol className="list-decimal pl-6 space-y-2 mb-6 marker:text-[#014E87]" {...p} />,
  table: (p) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="text-left bg-[#F8FAFC] border border-[#E5E7EB] px-4 py-2 font-medium text-[#014E87]" {...p} />,
  td: (p) => <td className="border border-[#E5E7EB] px-4 py-2 text-[#475569]" {...p} />,
  code: (p) => <code className="bg-[#F8FAFC] px-1.5 py-0.5 rounded text-[#014E87] text-sm" {...p} />,
};

async function fetchPost(slug) {
  try {
    return await getBlogPostBySlug(slug);
  } catch (e) {
    return null;
  }
}

async function fetchRelated(category, currentSlug) {
  try {
    const { posts = [] } = await listBlogPosts({ category, limit: 6 });
    return posts.filter((p) => p.slug !== currentSlug).slice(0, 3);
  } catch (e) {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) {
    return { title: "Article not found", robots: { index: false } };
  }
  return {
    title: post.title,
    description: post.meta_description,
    keywords: (post.keywords || []).join(", "),
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.meta_description,
      images: post.hero_image ? [post.hero_image] : undefined,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.meta_description,
      images: post.hero_image ? [post.hero_image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();
  const related = await fetchRelated(post.category, post.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta_description,
    datePublished: post.published_at,
    dateModified: post.published_at,
    image: post.hero_image,
    author: { "@type": "Organization", name: post.author || "refundmysuper" },
    publisher: {
      "@type": "Organization",
      name: "refundmysuper",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    keywords: (post.keywords || []).join(", "),
  };

  return (
    <div className="bg-[#F2F2F2] min-h-screen text-[#014E87]">
      <SEO jsonLd={jsonLd} />
      <Header />

      <section className="px-6 md:px-12 lg:px-24 pt-10 pb-6">
        <Link
          href="/blog"
          data-testid="blog-back"
          className="inline-flex items-center gap-1 text-sm text-[#475569] hover:text-[#014E87] mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#475569] mb-4">
            <span className="text-[#014E87] font-medium">{post.category}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading_time_minutes} min read</span>
            <span>·</span>
            <span>{post.author}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.05] mb-5">
            {post.title}
          </h1>
          <p className="text-lg text-[#475569] leading-relaxed">{post.excerpt}</p>
        </div>
      </section>

      {post.hero_image && (
        <div className="px-6 md:px-12 lg:px-24 pb-8">
          <div className="rounded-2xl overflow-hidden aspect-[21/9] bg-[#F8FAFC] max-w-5xl">
            <img src={post.hero_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      <section className="px-6 md:px-12 lg:px-24 pb-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <article className="lg:col-span-8 max-w-none text-lg" data-testid="blog-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {post.content}
            </ReactMarkdown>

            <div className="mt-10">
              <BlogCTA />
            </div>

            <Comments slug={post.slug} />

            <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#E5E7EB]">
              <div className="text-xs text-[#475569]">
                Tags:{" "}
                {(post.tags || []).map((tag, i) => (
                  <span key={tag} className="text-[#014E87]">
                    {i > 0 && ", "}#{tag}
                  </span>
                ))}
              </div>
              <BlogShareButton title={post.title} />
            </div>
          </article>

          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
                <h4 className="font-display text-lg font-medium mb-3">Estimate your refund</h4>
                <p className="text-sm text-[#475569] mb-4 leading-relaxed">
                  Three minutes, no paperwork. See exactly how much of your Australian super you can claim back today.
                </p>
                <Button
                  asChild
                  data-testid="sidebar-cta"
                  className="w-full bg-[#014E87] hover:bg-[#013A66] text-white h-11 rounded-lg shadow-[0_4px_14px_0_rgba(1, 78, 135, 0.28)]"
                >
                  <Link href="/#estimator">
                    Get my free estimate <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {related.length > 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6" data-testid="related-posts">
                  <h4 className="font-display text-lg font-medium mb-4">Related reads</h4>
                  <ul className="space-y-3">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link
                          href={`/blog/${r.slug}`}
                          className="group flex flex-col gap-1"
                          data-testid={`related-${r.slug}`}
                        >
                          <span className="text-xs text-[#014E87] uppercase tracking-[0.15em]">{r.category}</span>
                          <span className="text-sm text-[#014E87] font-medium group-hover:text-[#014E87] leading-snug">
                            {r.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <Footer />
      <WhatsAppChatButton watchInactivity />
    </div>
  );
}
