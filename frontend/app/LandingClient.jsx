"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Award, Zap, Globe2, Headphones, ChevronRight, ArrowRight, Clock } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Estimator from "@/components/Estimator";
import WhatsAppChatButton from "@/components/WhatsAppChatButton";
import RefBanner from "@/components/RefBanner";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const HERO_BG =
  "https://images.pexels.com/photos/542811/pexels-photo-542811.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const TESTI_1 =
  "https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400";
const TESTI_2 =
  "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400";

const TRUST_ITEMS = [
  { icon: ShieldCheck, key: "trust.ssl" },
  { icon: Lock, key: "trust.gdpr" },
  { icon: Award, key: "trust.tpb" },
  { icon: Zap, key: "trust.speed" },
  { icon: Globe2, key: "trust.unclaimed" },
  { icon: Headphones, key: "trust.whatsapp" },
];

const FAQ = [
  {
    q: "Am I eligible for a DASP refund?",
    a: "If you held a temporary visa (e.g., Working Holiday 417/462, Student 500, Temporary Work 482) and have permanently left Australia with your visa cancelled or expired, you can claim your super through the Departing Australia Superannuation Payment (DASP) scheme.",
  },
  {
    q: "How much will I actually get back?",
    a: "It depends on your visa: Working Holiday Maker visas (417/462) have 65% tax withheld — you keep 35%. Most other temporary visas (Student 500, 482, etc.) have 35% tax withheld — you keep 65% of your super balance.",
  },
  {
    q: "How long does the refund take?",
    a: "Once your application is lodged with your super fund and the ATO, payments usually take 28 days. We handle the paperwork and chase up delays on your behalf.",
  },
  {
    q: "Is AussieBack a tax agent?",
    a: "AussieBack is a facilitation platform. We work alongside Tax Practitioners Board (TPB)-registered tax agents who manage the formal claim on your behalf so it's done correctly and compliantly.",
  },
  {
    q: "How much do you charge?",
    a: "We charge a small success fee that's only deducted from your refund — if you don't get paid, we don't get paid. Exact terms are shared after your free expert review.",
  },
];

const HERO_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Am I eligible for a DASP refund?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If you held a temporary visa (Working Holiday 417/462, Student 500, Temporary Work 482, etc.) and have permanently left Australia with your visa cancelled or expired, you can claim your super through the Departing Australia Superannuation Payment (DASP) scheme.",
      },
    },
    {
      "@type": "Question",
      "name": "How much of my super will I get back?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Working Holiday Maker visas (417/462) have 65% tax withheld so you keep 35%. Student 500 and most other temporary visas have 35% tax withheld so you keep 65% of your super balance.",
      },
    },
    {
      "@type": "Question",
      "name": "How long does the Australian super refund take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Once your application is lodged with your super fund and the ATO, payments usually take 28 days.",
      },
    },
  ],
};

export default function LandingClient() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const estimatorRef = useRef(null);
  const [blogPosts, setBlogPosts] = useState([]);

  const scrollToEstimator = () => {
    estimatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // If we land here with a #estimator hash (e.g. from a blog CTA), scroll into view.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#estimator") {
      setTimeout(scrollToEstimator, 100);
    }
  }, [pathname, searchParams]);

  // Load 3 latest blog posts for the snippet section
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/blog/posts", { params: { limit: 3 } });
        setBlogPosts(data.posts || []);
      } catch (e) {
        /* silent */
      }
    })();
  }, []);

  return (
    <div className="bg-[#F2F2F2] min-h-screen text-[#014E87]">
      <SEO jsonLd={HERO_JSONLD} />
      <Header onCtaClick={scrollToEstimator} />
      <RefBanner />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 ab-hero-gradient" />
        <div className="absolute inset-0 ab-grain opacity-50" />

        <div className="relative px-6 md:px-12 lg:px-24 pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-[#E5E7EB] rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-[#014E87] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#014E87] animate-pulse" />
              {t("hero.eyebrow")}
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-semibold leading-[1.02] tracking-tight text-[#014E87] mb-6">
              {t("hero.title_1")} <br />
              <span className="text-[#014E87]">{t("hero.title_2")}</span>
            </h1>
            <p className="text-lg md:text-xl text-[#475569] max-w-xl mb-8 leading-relaxed">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Button
                data-testid="hero-cta"
                onClick={scrollToEstimator}
                className="bg-[#014E87] hover:bg-[#013A66] text-white h-14 px-7 rounded-lg shadow-[0_4px_14px_0_rgba(1, 78, 135, 0.28)] hover:-translate-y-0.5 transition-all text-base"
              >
                {t("hero.cta_primary")} <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              <a
                href="#how"
                className="inline-flex items-center justify-center border-2 border-[#014E87]/15 hover:border-[#014E87]/40 text-[#014E87] h-14 px-7 rounded-lg transition-colors text-base"
                data-testid="hero-secondary"
              >
                {t("hero.cta_secondary")}
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#475569]">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#2E7D32]" /> {t("hero.badge_paperwork")}</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-[#014E87]" /> {t("hero.badge_free")}</span>
              <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-[#014E87]" /> {t("hero.badge_security")}</span>
            </div>
          </motion.div>

          <motion.div
            ref={estimatorRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-5 flex justify-center lg:justify-end"
          >
            <Estimator />
          </motion.div>
        </div>
      </section>

      {/* TRUST MARQUEE */}
      <section className="bg-white border-y border-[#E5E7EB] overflow-hidden">
        <div className="py-6 overflow-hidden">
          <div className="marquee">
            {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-2 text-[#014E87] whitespace-nowrap">
                  <Icon className="h-4 w-4 text-[#014E87]" />
                  <span className="text-sm font-medium">{t(item.key)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 md:px-12 lg:px-24 py-20 md:py-28">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-[0.18em] text-[#014E87] mb-3 font-medium">
            How it works
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
            From "is this real?" to refund-in-bank in three steps.
          </h2>
          <p className="text-lg text-[#475569]">
            We've stripped out the admin nightmare. Here's all you do.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              title: "Get an instant estimate",
              body: "Pick your visa type. Enter your super balance — or slide your earnings. See your refund in seconds.",
            },
            {
              n: "02",
              title: "Confirm your details",
              body: "Tell us your name, email, and WhatsApp. We'll reach out within 1 business day with next steps.",
            },
            {
              n: "03",
              title: "Get paid, anywhere",
              body: "Our TPB-partnered agents file your DASP claim. Your refund lands in your bank — even overseas.",
            },
          ].map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white border border-[#E5E7EB] rounded-2xl p-8 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(1, 78, 135, 0.15)] transition-all"
              data-testid={`how-step-${i + 1}`}
            >
              <div className="font-display text-5xl text-[#014E87] mb-4">{s.n}</div>
              <h3 className="font-display text-xl font-medium mb-2 text-[#014E87]">
                {s.title}
              </h3>
              <p className="text-[#475569] leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="px-6 md:px-12 lg:px-24 py-20 md:py-28 bg-white border-y border-[#E5E7EB]">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#014E87] mb-3 font-medium">
              {t("stories.eyebrow")}
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              {t("stories.title")}
            </h2>
            <p className="text-lg text-[#475569]">
              {t("stories.subtitle")}
            </p>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
            {[
              {
                name: "Priya, 32 — Mumbai 🇮🇳",
                visa: "Skilled Work 482",
                amount: "$14,860",
                quote:
                  "After three years in Sydney I moved back to India and had no idea my super was still there. Super Refund Australia handled every form — the amount landed in my HDFC account in 26 days.",
                img: TESTI_1,
              },
              {
                name: "Wei, 28 — Shanghai 🇨🇳",
                visa: "Student Visa 500",
                amount: "$8,410",
                quote:
                  "Clear, professional, and completely stress-free. Two WhatsApp messages and one signed form. Money in my Bank of China account before I even finished unpacking.",
                img: TESTI_2,
              },
            ].map((testi, i) => (
              <div
                key={i}
                data-testid={`testimonial-${i + 1}`}
                className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={testi.img} alt={testi.name} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <div className="font-display font-medium text-[#014E87]">{testi.name}</div>
                    <div className="text-xs text-[#475569]">{testi.visa}</div>
                  </div>
                </div>
                <p className="text-[#014E87] leading-relaxed flex-1 mb-4">"{testi.quote}"</p>
                <div className="text-xs uppercase tracking-[0.15em] text-[#475569]">
                  {t("stories.recovered")}
                </div>
                <div className="font-display text-2xl text-[#014E87] font-medium">{testi.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 md:px-12 lg:px-24 py-20 md:py-28">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#014E87] mb-3 font-medium">
              {t("faq.eyebrow")}
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              {t("faq.title")}
            </h2>
            <p className="text-[#475569]">
              {t("faq.subtitle")}
            </p>
          </div>
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
              {FAQ.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-[#E5E7EB]">
                  <AccordionTrigger
                    data-testid={`faq-trigger-${i}`}
                    className="text-left font-display text-lg text-[#014E87] hover:no-underline py-5"
                  >
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#475569] leading-relaxed text-base">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* FROM THE BLOG */}
      {blogPosts.length > 0 && (
        <section id="blog" className="px-6 md:px-12 lg:px-24 py-20 md:py-24 bg-white border-y border-[#E5E7EB]">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.18em] text-[#014E87] mb-3 font-medium">
                {t("blog_snippet.eyebrow")}
              </div>
              <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-3">
                {t("blog_snippet.title")}
              </h2>
              <p className="text-lg text-[#475569]">{t("blog_snippet.subtitle")}</p>
            </div>
            <Link
              href="/blog"
              data-testid="landing-blog-all"
              className="inline-flex items-center gap-1 text-sm font-medium text-[#014E87] hover:text-[#014E87] transition-colors"
            >
              {t("blog_snippet.cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6" data-testid="landing-blog-grid">
            {blogPosts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                data-testid={`landing-blog-card-${p.slug}`}
                className="group bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(1, 78, 135, 0.15)] transition-all flex flex-col"
              >
                {p.hero_image && (
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={p.hero_image}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.15em] text-[#475569] mb-2">
                    <span className="text-[#014E87] font-medium">{p.category}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_time_minutes} min</span>
                  </div>
                  <h3 className="font-display text-lg font-medium text-[#014E87] leading-snug group-hover:text-[#014E87] transition-colors">
                    {p.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="px-6 md:px-12 lg:px-24 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#014E87] to-[#0076C2] text-white p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 ab-grain opacity-30" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              {t("final_cta.title")}
            </h2>
            <p className="text-[#94A3B8] text-lg mb-8 max-w-2xl mx-auto">
              {t("final_cta.subtitle")}
            </p>
            <Button
              data-testid="final-cta"
              onClick={scrollToEstimator}
              className="bg-[#014E87] hover:bg-[#013A66] text-white h-14 px-8 rounded-lg shadow-[0_4px_14px_0_rgba(1, 78, 135, 0.28)] hover:-translate-y-0.5 transition-all text-base"
            >
              {t("final_cta.button")} <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppChatButton watchInactivity />
    </div>
  );
}
