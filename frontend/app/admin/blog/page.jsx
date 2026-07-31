"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowLeft, Send, Copy, ExternalLink, Loader2, Save, Globe, Plus, Trash2, PlayCircle, Power, RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api } from "@/lib/api";
import AdminGuard from "@/components/AdminGuard";

function AdminBlogStudioInner() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState(null);

  const [settings, setSettings] = useState(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [gsv, setGsv] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [autopilot, setAutopilot] = useState({ config: { enabled: false }, queue: [] });
  const [apTopic, setApTopic] = useState("");
  const [apKeywords, setApKeywords] = useState("");
  const [apCategory, setApCategory] = useState("");
  const [apAdding, setApAdding] = useState(false);
  const [apRunning, setApRunning] = useState(false);
  const [requeueingId, setRequeueingId] = useState(null);

  const loadSettings = async () => {
    try {
      const { data } = await api.get("/admin/site-settings");
      setSettings(data);
      setSiteUrl(data.db_overrides.site_url || "");
      setGsv(data.db_overrides.google_site_verification || "");
    } catch (e) { /* silent */ }
  };

  const loadAutopilot = async () => {
    try {
      const { data } = await api.get("/admin/autopilot");
      setAutopilot(data);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    loadSettings();
    loadAutopilot();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data } = await api.put("/admin/site-settings", {
        site_url: siteUrl,
        google_site_verification: gsv,
      });
      const dbSite = siteUrl.trim() || null;
      const dbGsv = gsv.trim() || null;
      setSettings((s) => ({
        ...s,
        effective: data.effective,
        db_overrides: { site_url: dbSite, google_site_verification: dbGsv },
      }));
      setSiteUrl(dbSite || "");
      setGsv(dbGsv || "");
      toast.success("Site settings saved");
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleAutopilot = async (enabled) => {
    try {
      await api.patch("/admin/autopilot", { enabled });
      setAutopilot((a) => ({ ...a, config: { enabled } }));
      toast.success(enabled ? "Autopilot enabled" : "Autopilot paused");
    } catch (e) {
      toast.error("Failed to toggle");
    }
  };

  const addAutopilotItem = async () => {
    if (!apTopic.trim()) {
      toast.error("Topic required");
      return;
    }
    setApAdding(true);
    try {
      await api.post("/admin/autopilot/queue", {
        topic: apTopic.trim(),
        keywords: apKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        category: apCategory.trim() || null,
      });
      setApTopic("");
      setApKeywords("");
      setApCategory("");
      loadAutopilot();
      toast.success("Queued");
    } catch (e) {
      toast.error("Add failed");
    } finally {
      setApAdding(false);
    }
  };

  const removeAutopilotItem = async (id) => {
    try {
      await api.delete(`/admin/autopilot/queue/${id}`);
      loadAutopilot();
    } catch (e) {
      toast.error("Remove failed");
    }
  };

  const requeueAutopilotItem = async (id) => {
    setRequeueingId(id);
    try {
      await api.post(`/admin/autopilot/queue/${id}/requeue`);
      toast.success("Requeued — will run on next cycle");
      loadAutopilot();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Requeue failed");
    } finally {
      setRequeueingId(null);
    }
  };

  const runAutopilotNow = async () => {
    setApRunning(true);
    try {
      const { data } = await api.post("/admin/autopilot/run");
      if (data.skipped) toast.info(`Skipped: ${data.reason}`);
      else if (data.ok) toast.success(`Published /blog/${data.slug}`);
      else toast.error(data.error || "Autopilot failed");
      loadAutopilot();
    } catch (e) {
      toast.error("Run failed");
    } finally {
      setApRunning(false);
    }
  };

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
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
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
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-[#4A5D68] hover:text-[#0B2B40]" data-testid="back-to-admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span className="text-[#E8E6E1]">·</span>
            <div className="font-display font-medium">Blog Studio</div>
          </div>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8 grid lg:grid-cols-5 gap-8">
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

          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6" data-testid="site-settings-card">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#4A5D68] font-medium mb-3">
              <Globe className="h-3.5 w-3.5" /> Site settings
            </div>
            <p className="text-sm text-[#4A5D68] mb-4 leading-relaxed">
              Override the domain and Google verification without a redeploy. DB values take precedence over .env.
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Site URL (canonical)</Label>
                <Input
                  data-testid="settings-site-url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-10 mt-1"
                  placeholder="https://get.aussieback.co"
                />
              </div>
              <div>
                <Label className="text-xs">Google Search Console verification token</Label>
                <Input
                  data-testid="settings-gsv"
                  value={gsv}
                  onChange={(e) => setGsv(e.target.value)}
                  className="bg-[#FAFAF9] border-[#E8E6E1] h-10 mt-1 font-mono text-sm"
                  placeholder="abcd1234..."
                />
              </div>
              {settings?.effective && (
                <div className="text-[11px] text-[#4A5D68]">
                  Effective:{" "}
                  <code className="bg-[#FAFAF9] px-1 rounded">{settings.effective.site_url}</code>
                  {settings.effective.google_site_verification && <> · GSV set</>}
                </div>
              )}
              <Button
                data-testid="settings-save"
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full bg-[#0B2B40] hover:bg-[#082030] text-white h-10"
              >
                {savingSettings ? "Saving..." : "Save site settings"}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[#E8E6E1] rounded-2xl p-6" data-testid="autopilot-card">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#E05D43] font-medium">
                <Power className="h-3.5 w-3.5" /> Content Autopilot
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#4A5D68]">{autopilot.config?.enabled ? "On" : "Paused"}</span>
                <Switch
                  data-testid="autopilot-toggle"
                  checked={Boolean(autopilot.config?.enabled)}
                  onCheckedChange={toggleAutopilot}
                />
              </div>
            </div>
            <p className="text-sm text-[#4A5D68] mb-4 leading-relaxed">
              Cron runs every Monday 10:00 (Australia/Sydney) — pops one queued topic, drafts it with Claude Sonnet, and publishes it.
            </p>

            <div className="space-y-2 mb-3">
              <Input
                data-testid="ap-topic"
                value={apTopic}
                onChange={(e) => setApTopic(e.target.value)}
                placeholder="Topic (e.g. Korean backpackers claiming DASP)"
                className="bg-[#FAFAF9] border-[#E8E6E1] h-10"
              />
              <Input
                data-testid="ap-keywords"
                value={apKeywords}
                onChange={(e) => setApKeywords(e.target.value)}
                placeholder="Target keywords (comma-separated)"
                className="bg-[#FAFAF9] border-[#E8E6E1] h-10"
              />
              <Input
                data-testid="ap-category"
                value={apCategory}
                onChange={(e) => setApCategory(e.target.value)}
                placeholder="Category (optional)"
                className="bg-[#FAFAF9] border-[#E8E6E1] h-10"
              />
              <div className="flex gap-2">
                <Button
                  data-testid="ap-add"
                  onClick={addAutopilotItem}
                  disabled={apAdding}
                  variant="outline"
                  className="flex-1 border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40] h-10"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add to queue
                </Button>
                <Button
                  data-testid="ap-run-now"
                  onClick={runAutopilotNow}
                  disabled={apRunning}
                  className="bg-[#E05D43] hover:bg-[#C8533B] text-white h-10"
                >
                  {apRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                  Run now
                </Button>
              </div>
            </div>

            <div className="mt-3" data-testid="ap-queue">
              <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68] mb-2">
                Queue · {autopilot.queue.length}
              </div>
              {autopilot.queue.length === 0 ? (
                <p className="text-sm text-[#4A5D68]">No topics queued. Add some to keep the blog growing weekly.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {autopilot.queue.map((q) => {
                    const isFailed = q.status === "failed";
                    return (
                      <li
                        key={q.id}
                        data-testid={`ap-item-${q.id}`}
                        className={`border rounded-lg px-3 py-2 flex items-start justify-between gap-2 text-sm ${
                          isFailed ? "bg-[#FFF6F2] border-[#F3C8BB]" : "bg-[#FAFAF9] border-[#E8E6E1]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[#0B2B40] font-medium truncate">{q.topic}</div>
                          <div className="text-[11px] text-[#4A5D68] flex flex-wrap gap-x-2">
                            <span className={isFailed ? "text-[#9B3A26] font-medium" : ""}>{q.status}</span>
                            {q.category && <span>· {q.category}</span>}
                            {q.published_slug && <span>· /blog/{q.published_slug}</span>}
                          </div>
                          {isFailed && q.error && (
                            <div className="text-[11px] text-[#9B3A26] mt-1 truncate" title={q.error}>
                              {q.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isFailed && (
                            <button
                              type="button"
                              onClick={() => requeueAutopilotItem(q.id)}
                              disabled={requeueingId === q.id}
                              data-testid={`ap-requeue-${q.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#0B2B40] hover:bg-white border border-[#E8E6E1] rounded px-2 py-1 transition-colors disabled:opacity-50"
                              aria-label="Requeue"
                            >
                              {requeueingId === q.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              Requeue
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAutopilotItem(q.id)}
                            data-testid={`ap-remove-${q.id}`}
                            className="text-[#9B3A26] hover:bg-[#FFF6F2] rounded p-1"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

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
                  <Input data-testid="studio-title" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] mt-1" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Slug</Label>
                  <Input data-testid="studio-slug" value={draft.slug} onChange={(e) => updateDraft({ slug: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] mt-1 font-mono text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Meta description</Label>
                  <Textarea data-testid="studio-meta" value={draft.meta_description} onChange={(e) => updateDraft({ meta_description: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[70px] mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Excerpt</Label>
                  <Textarea data-testid="studio-excerpt" value={draft.excerpt} onChange={(e) => updateDraft({ excerpt: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[70px] mt-1" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Category</Label>
                  <Input data-testid="studio-cat" value={draft.category} onChange={(e) => updateDraft({ category: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] mt-1" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em]">Hero image URL</Label>
                  <Input data-testid="studio-hero" value={heroImage} onChange={(e) => setHeroImage(e.target.value)} className="bg-[#FAFAF9] border-[#E8E6E1] mt-1" placeholder="https://..." />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em]">Content (markdown)</Label>
                  <Textarea data-testid="studio-content" value={draft.content} onChange={(e) => updateDraft({ content: e.target.value })} className="bg-[#FAFAF9] border-[#E8E6E1] min-h-[300px] mt-1 font-mono text-sm" />
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-[#E8E6E1]">
                <div className="text-xs text-[#4A5D68]">
                  Tags: {draft.tags?.join(", ") || "—"} · Reading time: {draft.reading_time_minutes} min
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]">
                    <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer" data-testid="studio-preview">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview
                    </a>
                  </Button>
                  <Button onClick={publish} disabled={publishing} data-testid="studio-publish" className="bg-[#0B2B40] hover:bg-[#082030] text-white">
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

export default function AdminBlogStudioPage() {
  return (
    <AdminGuard>
      <AdminBlogStudioInner />
    </AdminGuard>
  );
}
