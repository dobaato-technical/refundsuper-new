"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Trash2, MessageCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import AdminGuard from "@/components/AdminGuard";

function AdminCommentsInner() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all"); // all | pending | approved
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === "pending") params.approved = false;
      if (filter === "approved") params.approved = true;
      const { data } = await api.get("/admin/comments", { params });
      setItems(data.comments);
    } catch (e) {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const approve = async (c) => {
    try {
      await api.patch(`/admin/comments/${c.id}/approve`);
      toast.success("Approved");
      load();
    } catch (e) {
      toast.error("Approve failed");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/comments/${pendingDelete.id}`);
      toast.success("Deleted");
      setPendingDelete(null);
      load();
    } catch (e) {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = items.filter((c) => !c.approved).length;

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#0B2B40]">
      <header className="bg-white border-b border-[#E8E6E1] sticky top-0 z-30">
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-[#4A5D68] hover:text-[#0B2B40]" data-testid="back-to-admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <span className="text-[#E8E6E1]">·</span>
            <div className="font-display font-medium">Comment moderation</div>
          </div>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-[#E05D43]" />
              {items.length} comments{pendingCount > 0 && <span className="text-sm text-[#E05D43] font-normal">· {pendingCount} pending</span>}
            </h1>
            <p className="text-[#4A5D68] mt-1">Approve, delete, or triage community stories.</p>
          </div>
          <div className="flex items-center gap-2" data-testid="comment-filter">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#4A5D68] mr-1">
              <Filter className="h-3 w-3" /> Show
            </span>
            {["all", "pending", "approved"].map((f) => (
              <button
                key={f}
                data-testid={`filter-${f}`}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === f
                    ? "bg-[#0B2B40] border-[#0B2B40] text-white"
                    : "bg-white border-[#E8E6E1] text-[#4A5D68] hover:border-[#0B2B40]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-[#4A5D68]">Loading...</p>
        ) : items.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E8E6E1] rounded-2xl p-12 text-center text-[#4A5D68]" data-testid="no-comments">
            No comments in this view.
          </div>
        ) : (
          <ul className="space-y-3" data-testid="comment-list">
            {items.map((c) => (
              <li
                key={c.id}
                data-testid={`comment-row-${c.id}`}
                className="bg-white border border-[#E8E6E1] rounded-xl p-5 flex flex-col sm:flex-row gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium text-[#0B2B40]">{c.author_name}</span>
                    <span className="text-xs text-[#4A5D68]">{c.author_email}</span>
                    <span
                      className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ${
                        c.approved ? "bg-[#E6EFD8] text-[#2E7D32]" : "bg-[#FFF6F2] text-[#9B3A26]"
                      }`}
                    >
                      {c.approved ? "approved" : "pending"}
                    </span>
                    {c.parent_id && (
                      <span className="text-[10px] uppercase tracking-[0.15em] text-[#4A5D68] bg-[#FAFAF9] border border-[#E8E6E1] px-2 py-0.5 rounded-full">
                        reply
                      </span>
                    )}
                  </div>
                  <p className="text-[#0B2B40] leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  <div className="text-xs text-[#4A5D68] mt-3">
                    on{" "}
                    <Link href={`/blog/${c.post_slug}`} target="_blank" rel="noreferrer" className="text-[#E05D43] hover:underline">
                      /blog/{c.post_slug}
                    </Link>{" "}
                    · {new Date(c.created_at).toLocaleString("en-AU")}
                  </div>
                </div>
                <div className="flex sm:flex-col gap-2 justify-end shrink-0">
                  {!c.approved && (
                    <Button
                      size="sm"
                      onClick={() => approve(c)}
                      data-testid={`approve-${c.id}`}
                      className="bg-[#2E7D32] hover:bg-[#256428] text-white"
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setPendingDelete(c)}
                    data-testid={`delete-${c.id}`}
                    variant="outline"
                    className="border-2 border-[#F3C8BB] text-[#9B3A26] hover:bg-[#FFF6F2]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  <span className="block mt-2 text-[#0B2B40] font-medium">{pendingDelete.author_name}</span>
                  <span className="block text-sm text-[#4A5D68] line-clamp-3 whitespace-pre-wrap">
                    &quot;{pendingDelete.body}&quot;
                  </span>
                  <span className="block mt-3 text-xs">
                    This will permanently remove the comment from{" "}
                    <code>/blog/{pendingDelete.post_slug}</code>. This action cannot be undone.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-[#9B3A26] hover:bg-[#7F2E1F] text-white"
            >
              {deleting ? "Deleting..." : "Delete comment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminCommentsPage() {
  return (
    <AdminGuard>
      <AdminCommentsInner />
    </AdminGuard>
  );
}
