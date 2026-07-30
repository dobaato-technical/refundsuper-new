import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Filter } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppChatButton from "@/components/WhatsAppChatButton";
import SEO from "@/components/SEO";
import BlogCTA from "@/components/BlogCTA";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function BlogList() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/blog/posts", { params: category ? { category } : {} });
        setPosts(data.posts);
        setCategories(data.categories);
      } catch (e) {
        /* ignore — empty state renders */
      } finally {
        setLoading(false);
      }
    })();
  }, [category]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "AussieBack — Super Refund Guides",
    "description": t("blog_list.subtitle"),
    "blogPost": posts.map((p) => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "url": `https://aussieback.com/blog/${p.slug}`,
      "datePublished": p.published_at,
      "author": { "@type": "Organization", "name": p.author || "AussieBack" },
      "image": p.hero_image,
    })),
  };

  return (
    <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40]">
      <SEO
        title={t("blog_list.seo_title")}
        description={t("blog_list.seo_description")}
        keywords="super refund australia, DASP guide, working holiday super refund, student super refund, backpacker tax australia"
        jsonLd={jsonLd}
      />
      <Header />

      <section className="px-6 md:px-12 lg:px-24 pt-14 pb-8 border-b border-[#E8E6E1]">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] text-[#E05D43] mb-3 font-medium">
            {t("blog_list.eyebrow")}
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-medium tracking-tight mb-4">
            {t("blog_list.title")}
          </h1>
          <p className="text-lg text-[#4A5D68] leading-relaxed">
            {t("blog_list.subtitle")}
          </p>
        </div>
      </section>

      <section className="px-6 md:px-12 lg:px-24 py-10">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-8" data-testid="blog-categories">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#4A5D68] mr-2">
              <Filter className="h-3 w-3" /> {t("blog_list.filter_label")}
            </span>
            <button
              type="button"
              data-testid="blog-cat-all"
              onClick={() => setCategory(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                category === null
                  ? "bg-[#0B2B40] border-[#0B2B40] text-white"
                  : "bg-white border-[#E8E6E1] text-[#4A5D68] hover:border-[#0B2B40]"
              }`}
            >
              {t("blog_list.filter_all")}
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                data-testid={`blog-cat-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => setCategory(c.name)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  category === c.name
                    ? "bg-[#0B2B40] border-[#0B2B40] text-white"
                    : "bg-white border-[#E8E6E1] text-[#4A5D68] hover:border-[#0B2B40]"
                }`}
              >
                {c.name} <span className="opacity-60">· {c.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-[#4A5D68]">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="text-[#4A5D68]" data-testid="blog-empty">
            {t("blog_list.empty")}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="blog-grid">
            {posts.map((p, i) => (
              <article
                key={p.slug}
                data-testid={`blog-card-${p.slug}`}
                className="group bg-white border border-[#E8E6E1] rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(11,43,64,0.18)] transition-all flex flex-col"
              >
                <Link to={`/blog/${p.slug}`} className="block">
                  <div className="aspect-[16/10] overflow-hidden bg-[#FAFAF9]">
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
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#4A5D68] mb-3">
                    <span className="text-[#E05D43] font-medium">{p.category}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_time_minutes} min</span>
                  </div>
                  <Link to={`/blog/${p.slug}`}>
                    <h2 className="font-display text-xl font-medium text-[#0B2B40] mb-2 leading-snug hover:text-[#E05D43] transition-colors">
                      {p.title}
                    </h2>
                  </Link>
                  <p className="text-sm text-[#4A5D68] leading-relaxed mb-4 flex-1">
                    {p.excerpt}
                  </p>
                  <Link
                    to={`/blog/${p.slug}`}
                    data-testid={`blog-read-${p.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#0B2B40] hover:text-[#E05D43] transition-colors"
                  >
                    {t("blog_list.read_more")} <ArrowRight className="h-4 w-4" />
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
