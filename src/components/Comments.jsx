"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Reply, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Threaded comment section for blog posts.
 * - Loads /api/blog/posts/{slug}/comments (approved only)
 * - Lets visitors post a new comment or reply to any existing one
 * - Renders replies indented under their parent (1 level of nesting shown; deeper still visible flat)
 */
export default function Comments({ slug }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [parentId, setParentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/blog/posts/${encodeURIComponent(slug)}/comments`);
      setComments(data.comments || []);
    } catch (e) {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Build a shallow tree — roots + first-level replies
  const tree = useMemo(() => {
    const byParent = new Map();
    comments.forEach((c) => {
      const key = c.parent_id || "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    });
    return byParent;
  }, [comments]);

  const roots = tree.get("root") || [];

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !body.trim()) {
      toast.error(t("comments.err_missing"));
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(
        `/blog/posts/${encodeURIComponent(slug)}/comments`,
        {
          author_name: name.trim(),
          author_email: email.trim(),
          body: body.trim(),
          parent_id: parentId,
        }
      );
      if (data.pending_moderation) {
        toast.success(t("comments.pending_moderation"));
      } else {
        toast.success(t("comments.posted"));
      }
      setBody("");
      setParentId(null);
      load();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) toast.error(t("comments.rate_limited"));
      else toast.error(err?.response?.data?.detail || t("comments.err_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="comments-section"
      className="mt-14 pt-10 border-t border-[#E5E7EB]"
    >
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="h-5 w-5 text-[#014E87]" />
        <h3 className="font-display text-2xl font-medium text-[#014E87]">
          {t("comments.title")} <span className="text-[#475569] font-normal text-lg">· {comments.length}</span>
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-[#475569]">Loading...</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-[#475569] mb-6" data-testid="comments-empty">
          {t("comments.empty")}
        </p>
      ) : (
        <ul className="space-y-6 mb-8" data-testid="comments-list">
          {roots.map((c) => (
            <li key={c.id} data-testid={`comment-${c.id}`}>
              <CommentCard c={c} onReply={setParentId} t={t} />
              {(tree.get(c.id) || []).map((child) => (
                <div key={child.id} className="ml-10 mt-4">
                  <CommentCard c={child} onReply={setParentId} t={t} nested />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}

      {/* Reply banner */}
      {parentId && (
        <div
          data-testid="reply-banner"
          className="rounded-lg border border-[#F3C8BB] bg-[#EBF3FA] px-4 py-2 mb-3 flex items-center justify-between text-sm"
        >
          <span className="text-[#9B3A26]">
            {t("comments.replying_to")}
          </span>
          <button
            type="button"
            onClick={() => setParentId(null)}
            className="text-[#014E87] font-medium hover:underline"
            data-testid="reply-cancel"
          >
            {t("comments.cancel")}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="bg-white border border-[#E5E7EB] rounded-2xl p-5" data-testid="comment-form">
        <h4 className="font-display text-lg font-medium mb-4 text-[#014E87]">
          {parentId ? t("comments.reply_heading") : t("comments.form_heading")}
        </h4>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-sm text-[#014E87]">{t("comments.name")}</Label>
            <Input
              data-testid="comment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#F8FAFC] border-[#E5E7EB] h-11 mt-1"
              placeholder="Alex"
              required
            />
          </div>
          <div>
            <Label className="text-sm text-[#014E87]">{t("comments.email")}</Label>
            <Input
              data-testid="comment-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#F8FAFC] border-[#E5E7EB] h-11 mt-1"
              placeholder="alex@example.com"
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <Label className="text-sm text-[#014E87]">{t("comments.body")}</Label>
          <Textarea
            data-testid="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="bg-[#F8FAFC] border-[#E5E7EB] min-h-[110px] mt-1"
            placeholder={t("comments.body_placeholder")}
            required
          />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-[#475569]">{t("comments.privacy_note")}</p>
          <Button
            type="submit"
            disabled={submitting}
            data-testid="comment-submit"
            className="bg-[#014E87] hover:bg-[#013A66] text-white h-11 rounded-lg shadow-[0_4px_14px_0_rgba(1, 78, 135, 0.28)]"
          >
            {submitting ? t("comments.posting") : t("comments.post_button")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function CommentCard({ c, onReply, t, nested = false }) {
  const date = new Date(c.created_at);
  const dateStr = isNaN(date) ? "" : date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div
      className={`rounded-xl p-4 ${nested ? "bg-[#F8FAFC] border border-[#E5E7EB]" : "bg-white border border-[#E5E7EB]"}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-full bg-[#EBF3FA] text-[#014E87] flex items-center justify-center">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-[#014E87] text-sm">{c.author_name}</div>
          <div className="text-[11px] text-[#475569]">{dateStr}</div>
        </div>
        {!nested && (
          <button
            type="button"
            onClick={() => onReply(c.id)}
            data-testid={`reply-${c.id}`}
            className="inline-flex items-center gap-1 text-xs text-[#475569] hover:text-[#014E87] transition-colors"
          >
            <Reply className="h-3.5 w-3.5" /> {t("comments.reply")}
          </button>
        )}
      </div>
      <p className="text-[#014E87] leading-relaxed whitespace-pre-wrap">{c.body}</p>
    </div>
  );
}
