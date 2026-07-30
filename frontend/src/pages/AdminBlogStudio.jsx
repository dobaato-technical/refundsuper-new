import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, ArrowLeft, Send, Copy, ExternalLink, Loader2, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Admin-only page: draft a keyword-targeted article via Claude Sonnet,
 * review it, then publish to the blog with a single click.
 */
export default function AdminBlogStudio() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState(null);

  const generate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setDrafting(true);
    setDraft(null);
    try {
      const { data } = await api.post("/admin/blog/generate-draft", {
        topic: topic.trim(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        category: category.trim() || null,
      });
      setDraft(data.draft);
      toast.success("Draft ready — review it below");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Draft generation failed");
    } finally {
      setDrafting(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      const payload = { ...draft, hero_image: heroImage.trim() || draft.hero_image || null };
      const { data } = await api.post("/admin/blog/posts", payload);
      toast.success(data.created ? `Published /blog/${data.slug}` : `Updated /blog/${data.slug}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const updateDraft = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const copyMarkdown = () => {
    if (!draft?.content) return;
    navigator.clipboard.writeText(draft.content);
    toast.success("Markdown copied");
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#0B2B40]">
      <header className="bg-white border-b border-[#E8E6E1] sticky top-0 z-30">
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-[#4A5D68] hover:text-[#0B2B40]" data-testid="back-to-admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span className="text-[#E8E6E1]">·</span>
            <div className="font-display font-medium">Blog Studio</div>
          </div>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8 grid lg:grid-cols-5 gap-8">
        {/* Left: prompt form */}
        <aside className="lg:col-span-2 space-y-4" data-testid="studio-prompt">
          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#E05D43] font-medium mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Claude Sonnet 4.6
            </div>
            <h1 className="font-display text-2xl font-medium mb-4">Draft a new article</h1>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Topic *</Label>
                <Input
                  data-testid="studio-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                  placeholder="Irish backpackers claiming DASP from Dublin"
                />
              </div>
              <div>
                <Label className="text-sm">Target keywords (comma-separated)</Label>
                <Input
                  data-testid="studio-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                  placeholder="irish super refund, DASP ireland"
                />
              </div>
              <div>
                <Label className="text-sm">Category (optional)</Label>
                <Input
                  data-testid="studio-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-11 mt-1"
                  placeholder="By Country"
                />
              </div>
            </div>
            <Button
              data-testid="studio-generate"
              onClick={generate}
              disabled={drafting}
              className="w-full mt-5 bg-[#E05D43] hover:bg-[#C8533B] text-white h-11 rounded-lg shadow-[0_4px_14px_0_rgba(224,93,67,0.39)]"
            >
              {drafting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Drafting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Generate draft</>
              )}
            </Button>
          </div>

          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 text-sm text-[#4A5D68] leading-relaxed">
            <strong className="text-[#0B2B40]">Suggested topics</strong>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>Irish, Italian, Korean backpackers claiming DASP</li>
              <li>Consolidating multiple super funds</li>
              <li>Currency &amp; forex tips for the payout</li>
              <li>TFN recovery guide</li>
              <li>Claiming after visa 485 → PR path</li>
            </ul>
          </div>
        </aside>

        {/* Right: draft preview + publish */}
        <section className="lg:col-span-3" data-testid="studio-draft">
          {!draft ? (
            <div className="bg-white border border-dashed border-[#E8E6E1] rounded-2xl p-10 text-center text-[#4A5D68]">
              Draft preview appears here. Fill in a topic and generate.
            </div>
          ) : (
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68]">Draft preview</div>
                <div className="flex gap-2">
                  <Button
                    onClick={copyMarkdown}
                    variant="outline"
                    size="sm"
                    data-testid="studio-copy"
                    className="border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy MD
                  </Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Title</Label>
                  <Input
                    data-testid="studio-title"
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Slug</Label>
                  <Input
                    data-testid="studio-slug"
                    value={draft.slug}
                    onChange={(e) => updateDraft({ slug: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] mt-1 font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Meta description</Label>
                  <Textarea
                    data-testid="studio-meta"
                    value={draft.meta_description}
                    onChange={(e) => updateDraft({ meta_description: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[70px] mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Excerpt</Label>
                  <Textarea
                    data-testid="studio-excerpt"
                    value={draft.excerpt}
                    onChange={(e) => updateDraft({ excerpt: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[70px] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Category</Label>
                  <Input
                    data-testid="studio-cat"
                    value={draft.category}
                    onChange={(e) => updateDraft({ category: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Hero image URL</Label>
                  <Input
                    data-testid="studio-hero"
                    value={heroImage}
                    onChange={(e) => setHeroImage(e.target.value)}
                    className="bg-[#FAFAF9] border-[#E8E6E1] mt-1"
                    placeholder="https://..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Content (markdown)</Label>
                  <Textarea
                    data-testid="studio-content"
                    value={draft.content}
                    onChange={(e) => updateDraft({ content: e.target.value })}
                    className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[300px] mt-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-[#E8E6E1]">
                <div className="text-xs text-[#4A5D68]">
                  Tags: {draft.tags?.join(", ") || "—"} · Reading time: {draft.reading_time_minutes} min
                </div>
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
                  >
                    <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer" data-testid="studio-preview">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                    </a>
                  </Button>
                  <Button
                    onClick={publish}
                    disabled={publishing}
                    data-testid="studio-publish"
                    className="bg-[#0B2B40] hover:bg-[#082030] text-white"
                  >
                    {publishing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Publish</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
