import { useRef } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Award, Zap, Globe2, Headphones, ChevronRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Estimator from "@/components/Estimator";
import { Button } from "@/components/ui/button";

const HERO_BG =
  "https://images.pexels.com/photos/542811/pexels-photo-542811.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const TESTI_1 =
  "https://images.pexels.com/photos/23225205/pexels-photo-23225205.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400";
const TESTI_2 =
  "https://images.unsplash.com/photo-1548213238-0da7521bd6e0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwyfHxoYXBweSUyMGJhY2twYWNrZXIlMjB0cmF2ZWxlcnxlbnwwfHx8fDE3ODIxMzE5MjV8MA&ixlib=rb-4.1.0&q=85&w=400&h=400";

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "256-bit SSL secured" },
  { icon: Lock, label: "GDPR-compliant" },
  { icon: Award, label: "Partnered with TPB tax agents" },
  { icon: Zap, label: "Avg 3-min estimate" },
  { icon: Globe2, label: "$87M+ in super sitting unclaimed*" },
  { icon: Headphones, label: "WhatsApp support, 6 languages" },
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

export default function Landing() {
  const estimatorRef = useRef(null);

  const scrollToEstimator = () => {
    estimatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="bg-[#F7F5F0] min-h-screen text-[#0B2B40]">
      <Header onCtaClick={scrollToEstimator} />

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
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-[#E8E6E1] rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-[#0B2B40] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E05D43] animate-pulse" />
              DASP refund — backpackers, students, temp visas
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-semibold leading-[1.02] tracking-tight text-[#0B2B40] mb-6">
              Left Australia? <br />
              <span className="text-[#E05D43]">Don't leave your cash behind.</span>
            </h1>
            <p className="text-lg md:text-xl text-[#4A5D68] max-w-xl mb-8 leading-relaxed">
              Estimate and claim your Australian Super refund in under 3 minutes.
              Free estimate. Expert review. Paid straight to your bank — anywhere in the world.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Button
                data-testid="hero-cta"
                onClick={scrollToEstimator}
                className="bg-[#E05D43] hover:bg-[#C8533B] text-white h-14 px-7 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all text-base"
              >
                Calculate my refund <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              <a
                href="#how"
                className="inline-flex items-center justify-center border-2 border-[#0B2B40]/15 hover:border-[#0B2B40]/40 text-[#0B2B40] h-14 px-7 rounded-lg transition-colors text-base"
                data-testid="hero-secondary"
              >
                How it works
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#4A5D68]">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#2E7D32]" /> No paperwork up front</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-[#E05D43]" /> Free estimate</span>
              <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-[#0B2B40]" /> Bank-grade security</span>
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
      <section className="bg-white border-y border-[#E8E6E1] overflow-hidden">
        <div className="py-6 overflow-hidden">
          <div className="marquee">
            {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-2 text-[#0B2B40] whitespace-nowrap">
                  <Icon className="h-4 w-4 text-[#E05D43]" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 md:px-12 lg:px-24 py-20 md:py-28">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-[0.18em] text-[#E05D43] mb-3 font-medium">
            How it works
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
            From "is this real?" to refund-in-bank in three steps.
          </h2>
          <p className="text-lg text-[#4A5D68]">
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
              className="bg-white border border-[#E8E6E1] rounded-2xl p-8 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(11,43,64,0.15)] transition-all"
              data-testid={`how-step-${i + 1}`}
            >
              <div className="font-display text-5xl text-[#E05D43] mb-4">{s.n}</div>
              <h3 className="font-display text-xl font-medium mb-2 text-[#0B2B40]">
                {s.title}
              </h3>
              <p className="text-[#4A5D68] leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="px-6 md:px-12 lg:px-24 py-20 md:py-28 bg-white border-y border-[#E8E6E1]">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#E05D43] mb-3 font-medium">
              Stories
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              Travellers, students, and working holidaymakers — paid.
            </h2>
            <p className="text-lg text-[#4A5D68]">
              Real people who didn't realise they had thousands waiting in Australia.
            </p>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
            {[
              {
                name: "Lena, 27 — Germany 🇩🇪",
                visa: "Working Holiday 417",
                amount: "$3,240",
                quote:
                  "I thought my super was gone forever. AussieBack made it embarrassingly easy. Money hit my German account three weeks later.",
                img: TESTI_1,
              },
              {
                name: "Daichi, 24 — Japan 🇯🇵",
                visa: "Student Visa 500",
                amount: "$6,180",
                quote:
                  "Total no-brainer. I sent two screenshots over WhatsApp. They handled the rest.",
                img: TESTI_2,
              },
            ].map((t, i) => (
              <div
                key={i}
                data-testid={`testimonial-${i + 1}`}
                className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={t.img} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <div className="font-display font-medium text-[#0B2B40]">{t.name}</div>
                    <div className="text-xs text-[#4A5D68]">{t.visa}</div>
                  </div>
                </div>
                <p className="text-[#0B2B40] leading-relaxed flex-1 mb-4">"{t.quote}"</p>
                <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68]">
                  Recovered
                </div>
                <div className="font-display text-2xl text-[#E05D43] font-medium">{t.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 md:px-12 lg:px-24 py-20 md:py-28">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[#E05D43] mb-3 font-medium">
              FAQ
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              Questions, answered.
            </h2>
            <p className="text-[#4A5D68]">
              Still wondering? WhatsApp us — we usually reply in under an hour.
            </p>
          </div>
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
              {FAQ.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-[#E8E6E1]">
                  <AccordionTrigger
                    data-testid={`faq-trigger-${i}`}
                    className="text-left font-display text-lg text-[#0B2B40] hover:no-underline py-5"
                  >
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[#4A5D68] leading-relaxed text-base">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 md:px-12 lg:px-24 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#0B2B40] to-[#143C56] text-white p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 ab-grain opacity-30" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl font-medium tracking-tight mb-4">
              Your super is still waiting in Australia.
            </h2>
            <p className="text-[#A9BDCB] text-lg mb-8 max-w-2xl mx-auto">
              Free estimate. Zero risk. You only pay if we successfully recover your refund.
            </p>
            <Button
              data-testid="final-cta"
              onClick={scrollToEstimator}
              className="bg-[#E05D43] hover:bg-[#C8533B] text-white h-14 px-8 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)] hover:-translate-y-0.5 transition-all text-base"
            >
              Start my free estimate <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
