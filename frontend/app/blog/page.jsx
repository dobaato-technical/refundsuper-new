import Link from "next/link";
import { Clock, ArrowRight, Filter } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppChatButton from "@/components/WhatsAppChatButton";
import SEO from "@/components/SEO";
import BlogCTA from "@/components/BlogCTA";
import { apiFetch } from "@/lib/serverApi";

const SITE_URL = process.env.REACT_APP_SITE_URL || "https://aussieback.com";

export const metadata = {
  title: "The Super Refund Playbook",
  description:
    "Guides, case studies and country deep-dives to help temporary residents claim their Australian Super refund (DASP) quickly and safely.",
  keywords:
    "super refund australia, DASP guide, working holiday super refund, student super refund, backpacker tax australia",
  alternates: { canonical: "/blog" },
};

async function fetchPosts(category) {
  try {
    return await apiFetch("/blog/posts", { params: { category } });
  } catch (e) {
    return { posts: [], categories: [] };
  }
}

export default async function BlogListPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const category = typeof sp.category === "string" ? sp.category : null;
  const { posts = [], categories = [] } = await fetchPosts(category);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "AussieBack — Super Refund Guides",
    description:
      "Guides, case studies and country deep-dives to help temporary residents claim their Australian Super refund (DASP).",
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.published_at,
      author: { "@type": "Organization", name: p.author || "AussieBack" },
      image: p.hero_image,
    })),
  };

  return (
    <div className="bg-[#F2F2F2] min-h-screen text-[#014E87]">
      <SEO jsonLd={jsonLd} />
      <Header />

      <section className="px-6 md:px-12 lg:px-24 pt-14 pb-8 border-b border-[#E5E7EB]">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] text-[#014E87] mb-3 font-medium">
            AussieBack blog
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-medium tracking-tight mb-4">
            The Super Refund Playbook
          </h1>
          <p className="text-lg text-[#475569] leading-relaxed">
            Guides, case studies and country deep-dives to help temporary residents claim their Australian Super refund quickly and safely.
          </p>
        </div>
      </section>

      <section className="px-6 md:px-12 lg:px-24 py-10">
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-8" data-testid="blog-categories">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#475569] mr-2">
              <Filter className="h-3 w-3" /> Filter
            </span>
            <Link
              data-testid="blog-cat-all"
              href="/blog"
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !category
                  ? "bg-[#014E87] border-[#014E87] text-white"
                  : "bg-white border-[#E5E7EB] text-[#475569] hover:border-[#014E87]"
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.name}
                data-testid={`blog-cat-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
                href={`/blog?category=${encodeURIComponent(c.name)}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  category === c.name
                    ? "bg-[#014E87] border-[#014E87] text-white"
                    : "bg-white border-[#E5E7EB] text-[#475569] hover:border-[#014E87]"
                }`}
              >
                {c.name} <span className="opacity-60">· {c.count}</span>
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-[#475569]" data-testid="blog-empty">
            No articles yet. Check back soon.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="blog-grid">
            {posts.map((p, i) => (
              <article
                key={p.slug}
                data-testid={`blog-card-${p.slug}`}
                className="group bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(1, 78, 135, 0.18)] transition-all flex flex-col"
              >
                <Link href={`/blog/${p.slug}`} className="block">
                  <div className="aspect-[16/10] overflow-hidden bg-[#F8FAFC]">
                    {p.hero_image && (
                      <img
                        src={p.hero_image}
                        alt={p.title}
                        loading={i > 2 ? "lazy" : "eager"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#475569] mb-3">
                    <span className="text-[#014E87] font-medium">{p.category}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_time_minutes} min</span>
                  </div>
                  <Link href={`/blog/${p.slug}`}>
                    <h2 className="font-display text-xl font-medium text-[#014E87] mb-2 leading-snug hover:text-[#014E87] transition-colors">
                      {p.title}
                    </h2>
                  </Link>
                  <p className="text-sm text-[#475569] leading-relaxed mb-4 flex-1">
                    {p.excerpt}
                  </p>
                  <Link
                    href={`/blog/${p.slug}`}
                    data-testid={`blog-read-${p.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#014E87] hover:text-[#014E87] transition-colors"
                  >
                    Read guide <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-14">
          <BlogCTA />
        </div>
      </section>

      <Footer />
      <WhatsAppChatButton watchInactivity />
    </div>
  );
}
