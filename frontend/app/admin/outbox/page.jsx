"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Radio, RotateCcw, Trash2, Zap, ChevronRight, Filter, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import AdminGuard from "@/components/AdminGuard";

const STATUS_COLORS = {
  pending: "bg-[#FFF4DC] text-[#7A5A12] border-[#F1D77A]",
  success: "bg-[#E6EFD8] text-[#2E7D32] border-[#B8D19A]",
  dead: "bg-[#FFF6F2] text-[#9B3A26] border-[#F3C8BB]",
};

function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const s = Math.floor(abs / 1000);
  if (s < 60) return diff >= 0 ? `${s}s ago` : `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return diff >= 0 ? `${m}m ago` : `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return diff >= 0 ? `${h}h ago` : `in ${h}h`;
  const d = Math.floor(h / 24);
  return diff >= 0 ? `${d}d ago` : `in ${d}d`;
}

function OutboxInner() {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, success: 0, dead: 0 });
  const [maxAttempts, setMaxAttempts] = useState(8);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [flushing, setFlushing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get("/admin/outbox", { params });
      setRows(data.outbox);
      setCounts(data.counts);
      setMaxAttempts(data.max_attempts);
    } catch (e) {
      toast.error("Failed to load outbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const flushNow = async () => {
    setFlushing(true);
    try {
      const { data } = await api.post("/admin/outbox/process-now");
      toast.success(`Flushed · ${data.success} delivered / ${data.failed} failed`);
      load();
    } catch (e) {
      toast.error("Flush failed");
    } finally {
      setFlushing(false);
    }
  };

  const retry = async (row) => {
    try {
      await api.post(`/admin/outbox/${row.id}/retry`);
      toast.success("Retry scheduled — will fire on the next tick");
      load();
    } catch (e) {
      toast.error("Retry failed");
    }
  };

  const remove = async (row) => {
    try {
      await api.delete(`/admin/outbox/${row.id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const copyBody = (row) => {
    navigator.clipboard.writeText(row.body || "");
    toast.success("Payload copied");
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
            <div className="font-display font-medium flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#E05D43]" />
              Webhook outbox
            </div>
          </div>
          <Button
            data-testid="outbox-flush"
            onClick={flushNow}
            disabled={flushing}
            className="bg-[#0B2B40] hover:bg-[#082030] text-white"
          >
            <Zap className="h-4 w-4 mr-2" /> {flushing ? "Flushing..." : "Flush now"}
          </Button>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { key: "pending", label: "Pending", color: "text-[#7A5A12]", bg: "bg-[#FFF4DC]" },
            { key: "success", label: "Delivered", color: "text-[#2E7D32]", bg: "bg-[#E6EFD8]" },
            { key: "dead", label: "Dead", color: "text-[#9B3A26]", bg: "bg-[#FFF6F2]" },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(filter === c.key ? "" : c.key)}
              data-testid={`outbox-count-${c.key}`}
              className={`text-left bg-white border rounded-xl p-5 transition-all hover:-translate-y-0.5 ${
                filter === c.key ? "border-[#0B2B40]" : "border-[#E8E6E1]"
              }`}
            >
              <div className={`inline-flex h-10 w-10 rounded-lg items-center justify-center ${c.bg} ${c.color} mb-3`}>
                <Radio className="h-5 w-5" />
              </div>
              <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68]">{c.label}</div>
              <div className={`font-display text-3xl font-medium ${c.color}`}>{counts[c.key] ?? 0}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3" data-testid="outbox-filter-bar">
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#4A5D68] mr-1">
            <Filter className="h-3 w-3" /> Show
          </span>
          {["", "pending", "success", "dead"].map((f) => (
            <button
              key={f || "all"}
              onClick={() => setFilter(f)}
              data-testid={`outbox-filter-${f || "all"}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f
                  ? "bg-[#0B2B40] border-[#0B2B40] text-white"
                  : "bg-white border-[#E8E6E1] text-[#4A5D68] hover:border-[#0B2B40]"
              }`}
            >
              {f || "all"}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#4A5D68]">
            Auto-refreshes every 15s · max attempts {maxAttempts}
          </span>
        </div>

        {loading ? (
          <p className="text-[#4A5D68]">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E8E6E1] rounded-2xl p-12 text-center text-[#4A5D68]" data-testid="outbox-empty">
            No {filter || "outbox"} events yet. Once a lead is captured or a status changes, you'll see the CRM handoff here.
          </div>
        ) : (
          <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="outbox-table">
                <thead>
                  <tr className="border-b border-[#E8E6E1] bg-[#FAFAF9] text-left text-[11px] uppercase tracking-[0.15em] text-[#4A5D68]">
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Attempts</th>
                    <th className="px-4 py-3">Next / delivered</th>
                    <th className="px-4 py-3">Last error</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      data-testid={`outbox-row-${r.id}`}
                      className="border-b border-[#E8E6E1] last:border-0 hover:bg-[#FAFAF9] cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0B2B40]">{r.event}</div>
                        <div className="text-[11px] text-[#4A5D68]">
                          {relTime(r.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.attempts} <span className="opacity-40">/ {maxAttempts}</span>
                      </td>
                      <td className="px-4 py-3 text-[#4A5D68] text-xs">
                        {r.status === "success"
                          ? `delivered ${relTime(r.delivered_at)}`
                          : r.status === "dead"
                            ? "—"
                            : `retry ${relTime(r.next_attempt_at)}`}
                      </td>
                      <td className="px-4 py-3 text-[#9B3A26] text-xs max-w-xs truncate" title={r.last_error || ""}>
                        {r.last_error || (r.status === "success" ? "—" : "")}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => copyBody(r)}
                            data-testid={`outbox-copy-${r.id}`}
                            className="p-1.5 rounded text-[#4A5D68] hover:text-[#0B2B40] hover:bg-white"
                            aria-label="Copy payload"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {r.status !== "success" && (
                            <button
                              type="button"
                              onClick={() => retry(r)}
                              data-testid={`outbox-retry-${r.id}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#0B2B40] hover:bg-white border border-[#E8E6E1] rounded px-2 py-1 transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(r)}
                            data-testid={`outbox-delete-${r.id}`}
                            className="p-1.5 rounded text-[#9B3A26] hover:bg-[#FFF6F2]"
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-[#B8BEC5]" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl bg-white" data-testid="outbox-detail-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#0B2B40] flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#E05D43]" />
              {selected?.event}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#4A5D68]">
              Delivery details and signed JSON payload sent to your CRM webhook.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-[#4A5D68] uppercase tracking-[0.12em]">Status</span>
                  <div className="text-[#0B2B40] font-medium">{selected.status}</div>
                </div>
                <div>
                  <span className="text-[#4A5D68] uppercase tracking-[0.12em]">Attempts</span>
                  <div className="text-[#0B2B40] font-medium">{selected.attempts} / {maxAttempts}</div>
                </div>
                <div>
                  <span className="text-[#4A5D68] uppercase tracking-[0.12em]">Created</span>
                  <div className="text-[#0B2B40]">{new Date(selected.created_at).toLocaleString("en-AU")}</div>
                </div>
                {selected.delivered_at && (
                  <div>
                    <span className="text-[#4A5D68] uppercase tracking-[0.12em]">Delivered</span>
                    <div className="text-[#0B2B40]">{new Date(selected.delivered_at).toLocaleString("en-AU")}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-[#4A5D68] uppercase tracking-[0.12em]">URL</span>
                  <div className="text-[#0B2B40] break-all font-mono text-[11px]">{selected.url}</div>
                </div>
                {selected.last_error && (
                  <div className="col-span-2">
                    <span className="text-[#4A5D68] uppercase tracking-[0.12em]">Last error</span>
                    <div className="text-[#9B3A26] break-all">{selected.last_error}</div>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68] mb-1">Payload</div>
                <pre
                  data-testid="outbox-payload"
                  className="bg-[#FAFAF9] border border-[#E8E6E1] rounded-lg p-3 text-[11px] leading-relaxed overflow-x-auto max-h-72"
                >
{(() => {
  try { return JSON.stringify(JSON.parse(selected.body), null, 2); }
  catch (e) { return selected.body; }
})()}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminOutboxPage() {
  return (
    <AdminGuard>
      <OutboxInner />
    </AdminGuard>
  );
}
