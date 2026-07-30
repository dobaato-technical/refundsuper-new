import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Clock, ArrowLeft, Share2, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppChatButton from "@/components/WhatsAppChatButton";
import SEO from "@/components/SEO";
import BlogCTA from "@/components/BlogCTA";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Markdown renderer overrides — defined at module scope so react-i18next / reconciler
// don't recreate component types on every render.
const mdComponents = {
  h2: (p) => <h2 className="font-display text-3xl font-medium text-[#0B2B40] mt-10 mb-3 tracking-tight" {...p} />,
  h3: (p) => <h3 className="font-display text-2xl font-medium text-[#0B2B40] mt-8 mb-2 tracking-tight" {...p} />,
  p: (p) => <p className="text-[#0B2B40] leading-relaxed mb-4" {...p} />,
  a: (p) => <a className="text-[#E05D43] hover:underline underline-offset-2" {...p} />,
  blockquote: (p) => (
    <blockquote
      className="border-l-4 border-[#E05D43] bg-[#FFF6F2] px-5 py-3 my-6 rounded-r-lg text-[#0B2B40] italic"
      {...p}
    />
  ),
  ul: (p) => <ul className="list-disc pl-6 space-y-2 mb-6 marker:text-[#E05D43]" {...p} />,
  ol: (p) => <ol className="list-decimal pl-6 space-y-2 mb-6 marker:text-[#E05D43]" {...p} />,
  table: (p) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="text-left bg-[#FAFAF9] border border-[#E8E6E1] px-4 py-2 font-medium text-[#0B2B40]" {...p} />,
  td: (p) => <td className="border border-[#E8E6E1] px-4 py-2 text-[#4A5D68]" {...p} />,
  code: (p) => <code className="bg-[#FAFAF9] px-1.5 py-0.5 rounded text-[#0B2B40] text-sm" {...p} />,
};

export default function BlogPost() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    setPost(null);
    setNotFound(false);
    (async () => {
      try {
        const { data } = await api.get(`/blog/posts/${encodeURIComponent(slug)}`);
        setPost(data);
        const { data: listData } = await api.get("/blog/posts", {
          params: { category: data.category, limit: 6 },
        });
        setRelated((listData.posts || []).filter((p) => p.slug !== data.slug).slice(0, 3));
      } catch (e) {
        setNotFound(true);
      }
    })();
    window.scrollTo({ top: 0 });
  }, [slug]);

  const shareArticle = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: post?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("blog_post.link_copied"));
      }
    } catch (e) {
      /* user cancelled */
    }
  };

  if (notFound) {
    return (
      <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40]">
        <SEO title="Article not found" />
        <Header />
        <div className="px-6 md:px-12 lg:px-24 py-24 text-center">
          <h1 className="font-display text-4xl font-medium mb-3">Article not found</h1>
          <p className="text-[#4A5D68] mb-6">The article you're looking for has moved or does not exist.</p>
          <Button
            onClick={() => navigate("/blog")}
            className="bg-[#E05D43] hover:bg-[#C8533B] text-white"
            data-testid="back-to-blog"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to blog
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40]">
        <Header />
        <div className="px-6 md:px-12 lg:px-24 py-24 text-[#4A5D68]">Loading...</div>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.meta_description,
    "datePublished": post.published_at,
    "dateModified": post.published_at,
    "image": post.hero_image,
    "author": { "@type": "Organization", "name": post.author || "AussieBack" },
    "publisher": {
      "@type": "Organization",
      "name": "AussieBack",
      "logo": {
        "@type": "ImageObject",
        "url": "https://aussieback.com/logo.png",
      },
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://aussieback.com/blog/${post.slug}`,
    },
    "keywords": (post.keywords || []).join(", "),
  };

  return (
    <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40]">
      <SEO
        title={post.title}
        description={post.meta_description}
        image={post.hero_image}
        type="article"
        keywords={(post.keywords || []).join(", ")}
        jsonLd={jsonLd}
      />
      <Header />

      {/* Hero */}
      <section className="px-6 md:px-12 lg:px-24 pt-10 pb-6">
        <Link
          to="/blog"
          data-testid="blog-back"
          className="inline-flex items-center gap-1 text-sm text-[#4A5D68] hover:text-[#0B2B40] mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> {t("blog_post.all_articles")}
        </Link>
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#4A5D68] mb-4">
            <span className="text-[#E05D43] font-medium">{post.category}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading_time_minutes} min read</span>
            <span>·</span>
            <span>{post.author}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.05] mb-5">
            {post.title}
          </h1>
          <p className="text-lg text-[#4A5D68] leading-relaxed">{post.excerpt}</p>
        </div>
      </section>

      {post.hero_image && (
        <div className="px-6 md:px-12 lg:px-24 pb-8">
          <div className="rounded-2xl overflow-hidden aspect-[21/9] bg-[#FAFAF9] max-w-5xl">
            <img src={post.hero_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Article body */}
      <section className="px-6 md:px-12 lg:px-24 pb-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <article className="lg:col-span-8 max-w-none text-lg" data-testid="blog-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {post.content}
            </ReactMarkdown>

            {/* Inline CTA */}
            <div className="mt-10">
              <BlogCTA />
            </div>

            <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#E8E6E1]">
              <div className="text-xs text-[#4A5D68]">
                Tags:{" "}
                {(post.tags || []).map((tag, i) => (
                  <span key={tag} className="text-[#0B2B40]">
                    {i > 0 && ", "}#{tag}
                  </span>
                ))}
              </div>
              <Button
                data-testid="blog-share"
                onClick={shareArticle}
                variant="outline"
                size="sm"
                className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
              >
                <Share2 className="h-4 w-4 mr-2" /> {t("blog_post.share")}
              </Button>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6">
                <h4 className="font-display text-lg font-medium mb-3">{t("blog_post.sidebar_estimate_title")}</h4>
                <p className="text-sm text-[#4A5D68] mb-4 leading-relaxed">
                  {t("blog_post.sidebar_estimate_body")}
                </p>
                <Button
                  asChild
                  data-testid="sidebar-cta"
                  className="w-full bg-[#E05D43] hover:bg-[#C8533B] text-white h-11 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)]"
                >
                  <Link to="/#estimator">
                    {t("blog_post.sidebar_estimate_button")} <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {related.length > 0 && (
                <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6" data-testid="related-posts">
                  <h4 className="font-display text-lg font-medium mb-4">{t("blog_post.related_title")}</h4>
                  <ul className="space-y-3">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link
                          to={`/blog/${r.slug}`}
                          className="group flex flex-col gap-1"
                          data-testid={`related-${r.slug}`}
                        >
                          <span className="text-xs text-[#E05D43] uppercase tracking-[0.15em]">{r.category}</span>
                          <span className="text-sm text-[#0B2B40] font-medium group-hover:text-[#E05D43] leading-snug">
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
