"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, TrendingUp, DollarSign, Trophy, LogOut, Search,
  Download, RefreshCw, ChevronDown, Mail, Sparkles, MessageCircle, Radio,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api, API } from "@/lib/api";
import { clearAuth, getAdminEmail } from "@/lib/auth";
import { formatAUD, statusLabel, statusBadgeClass, STATUS_PIPELINE } from "@/lib/format";
import AdminGuard from "@/components/AdminGuard";

const VISA_LABEL = {
  working_holiday: "Working Holiday",
  other_temp: "Student / Other",
};

function AdminDashboardInner() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const [statsResp, leadsResp, analyticsResp] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/leads", { params }),
        api.get("/admin/analytics"),
      ]);
      setStats(statsResp.data);
      setLeads(leadsResp.data.leads);
      setAnalytics(analyticsResp.data);
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const logout = () => {
    clearAuth();
    router.push("/admin/login");
  };

  const updateStatus = async (lead, newStatus) => {
    try {
      await api.patch(`/admin/leads/${lead.id}/status`, { status: newStatus });
      toast.success(`Status → ${statusLabel(newStatus)}`);
      load();
      if (selected?.id === lead.id) setSelected({ ...selected, status: newStatus });
    } catch (e) {
      toast.error("Could not update status");
    }
  };

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("ab_admin_token");
      const resp = await fetch(`${API}/admin/leads/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aussieback_leads.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed");
    }
  };

  const runWeeklyDigest = async () => {
    try {
      const { data } = await api.post("/admin/weekly-digest/run");
      toast.success(`Digest generated · ${data.digest.new_leads_count} new leads`);
    } catch (e) {
      toast.error("Digest run failed");
    }
  };

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: Users, label: "Total leads", value: stats.total_leads, accent: "bg-[#EBF3FA] text-[#014E87]" },
      { icon: DollarSign, label: "Pipeline value", value: formatAUD(stats.pipeline_value), accent: "bg-[#E7EEF4] text-[#014E87]" },
      { icon: Trophy, label: "Recovered", value: formatAUD(stats.recovered_value), accent: "bg-[#E6EFD8] text-[#2E7D32]" },
      { icon: TrendingUp, label: "Conversion", value: `${stats.conversion_rate}%`, accent: "bg-[#FFF4DC] text-[#7A5A12]" },
    ];
  }, [stats]);

  return (
    <div className="min-h-screen bg-[#F2F2F2] text-[#014E87]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5" data-testid="admin-logo">
            <BrandLogo size="sm" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#0076C2] font-semibold border-l border-[#E5E7EB] pl-2.5 ml-0.5">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#475569] hidden md:inline">
              {getAdminEmail()}
            </span>
            <Button
              data-testid="logout-btn"
              variant="outline"
              onClick={logout}
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight">
              Lead pipeline
            </h1>
            <p className="text-[#475569] mt-1">
              Manage incoming refund estimates and move them through to payout.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="blog-studio-btn"
              asChild
              variant="outline"
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <Link href="/admin/blog">
                <Sparkles className="h-4 w-4 mr-2" /> Blog studio
              </Link>
            </Button>
            <Button
              data-testid="comments-btn"
              asChild
              variant="outline"
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <Link href="/admin/comments">
                <MessageCircle className="h-4 w-4 mr-2" /> Comments
              </Link>
            </Button>
            <Button
              data-testid="outbox-btn"
              asChild
              variant="outline"
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <Link href="/admin/outbox">
                <Radio className="h-4 w-4 mr-2" /> Outbox
              </Link>
            </Button>
            <Button
              data-testid="digest-btn"
              onClick={runWeeklyDigest}
              variant="outline"
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <Mail className="h-4 w-4 mr-2" /> Run digest
            </Button>
            <Button
              data-testid="refresh-btn"
              onClick={load}
              variant="outline"
              className="border-2 border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button
              data-testid="export-btn"
              onClick={exportCsv}
              className="bg-[#014E87] hover:bg-[#013A66] text-white"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex items-start gap-4 hover:-translate-y-0.5 transition-transform"
              >
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${s.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-[#475569] mb-1">
                    {s.label}
                  </div>
                  <div className="font-display text-2xl font-medium">{s.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {analytics && (
          <>
          <div className="grid lg:grid-cols-3 gap-4 mb-8" data-testid="analytics-panel">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5" data-testid="share-channels-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-[#475569]">
                    Share events
                  </div>
                  <div className="font-display text-2xl font-medium">
                    {analytics.share_events.total}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-[#EBF3FA] text-[#014E87] flex items-center justify-center text-lg">
                  ⇗
                </div>
              </div>
              <ul className="space-y-2">
                {Object.entries(analytics.share_events.by_channel).map(([ch, count]) => {
                  const total = Math.max(1, analytics.share_events.total);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <li key={ch} data-testid={`share-channel-${ch}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#014E87] capitalize">
                          {ch.replace("_", " ")}
                        </span>
                        <span className="text-[#475569] tabular-nums">
                          {count} <span className="opacity-60">· {pct}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#F0EEE9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#014E87]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 lg:col-span-2" data-testid="top-referrers-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-[#475569]">
                    Top referrers
                  </div>
                  <div className="font-display text-2xl font-medium">
                    {analytics.referrals.referred_leads_total}
                    <span className="text-sm text-[#475569] font-normal ml-2">
                      referred leads · {analytics.referrals.all_leads_total} total
                    </span>
                  </div>
                </div>
              </div>
              {analytics.referrals.top_referrers.length === 0 ? (
                <p className="text-sm text-[#475569]" data-testid="no-referrals">
                  No referred leads yet. Every submitted lead now gets a unique code — as friends claim through it, the top referrers will show here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-[#475569] border-b border-[#E5E7EB]">
                        <th className="py-2">Name</th>
                        <th className="py-2">Code</th>
                        <th className="py-2 text-right">Referred</th>
                        <th className="py-2 text-right">Pipeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.referrals.top_referrers.map((r) => (
                        <tr
                          key={r.lead_id}
                          className="border-b border-[#E5E7EB] last:border-0"
                          data-testid={`referrer-row-${r.referral_code}`}
                        >
                          <td className="py-3 font-medium text-[#014E87]">
                            {r.first_name}
                            <div className="text-xs text-[#475569] font-normal">{r.email}</div>
                          </td>
                          <td className="py-3 font-mono text-[#014E87]">{r.referral_code}</td>
                          <td className="py-3 text-right font-medium">{r.referred_count}</td>
                          <td className="py-3 text-right text-[#475569] tabular-nums">
                            {formatAUD(r.total_estimated)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-8" data-testid="utm-sources-card">
            <div className="text-xs uppercase tracking-[0.15em] text-[#475569] mb-3">
              UTM sources
            </div>
            {(!analytics.utm_sources || analytics.utm_sources.length === 0) ? (
              <p className="text-sm text-[#475569]" data-testid="no-utm">
                No UTM-tagged traffic yet. Share links like <code className="bg-[#F8FAFC] px-1 rounded">/?ref=CODE&amp;utm_source=tiktok</code> to see which channels drive claims.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-[#475569] border-b border-[#E5E7EB]">
                      <th className="py-2">Source</th>
                      <th className="py-2 text-right">Leads</th>
                      <th className="py-2 text-right">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.utm_sources.map((u) => (
                      <tr
                        key={u.source}
                        className="border-b border-[#E5E7EB] last:border-0"
                        data-testid={`utm-row-${u.source}`}
                      >
                        <td className="py-3 font-medium text-[#014E87] capitalize">{u.source}</td>
                        <td className="py-3 text-right">{u.leads}</td>
                        <td className="py-3 text-right text-[#475569] tabular-nums">
                          {formatAUD(u.pipeline)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
        )}

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg px-3">
            <Search className="h-4 w-4 text-[#475569]" />
            <Input
              data-testid="search-input"
              placeholder="Search name, email, WhatsApp, fund..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
            />
            <Button type="submit" size="sm" className="bg-[#014E87] hover:bg-[#013A66] text-white h-8" data-testid="search-btn">
              Search
            </Button>
          </form>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-64 bg-[#F8FAFC] border-[#E5E7EB] h-12" data-testid="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_PIPELINE.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="leads-table">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-left text-[11px] uppercase tracking-[0.15em] text-[#475569]">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email / WhatsApp</th>
                  <th className="px-5 py-3">Visa</th>
                  <th className="px-5 py-3 text-right">Est. Refund</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[#475569]">Loading...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[#475569]" data-testid="empty-leads">
                    No leads yet. Submit an estimate from the landing page to see one here.
                  </td></tr>
                ) : (
                  leads.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => setSelected(l)}
                      data-testid={`lead-row-${l.id}`}
                    >
                      <td className="px-5 py-4 font-medium text-[#014E87]">{l.first_name}</td>
                      <td className="px-5 py-4 text-[#475569]">
                        <div>{l.email}</div>
                        <div className="text-xs">{l.whatsapp_number}</div>
                      </td>
                      <td className="px-5 py-4 text-[#475569]">{VISA_LABEL[l.visa_type] || l.visa_type}</td>
                      <td className="px-5 py-4 text-right font-display font-medium text-[#014E87]">
                        {formatAUD(l.estimated_refund)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="outline" className={`border ${statusBadgeClass(l.status)}`}>
                          {statusLabel(l.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-[#475569] text-xs">
                        {new Date(l.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-[#E5E7EB]" data-testid={`status-menu-${l.id}`}>
                              Set status <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STATUS_PIPELINE.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => updateStatus(l, s)}
                                data-testid={`set-status-${l.id}-${s}`}
                              >
                                {statusLabel(s)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg bg-white" data-testid="lead-detail-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#014E87]">
              {selected?.first_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <Row label="Email" value={selected.email} />
              <Row label="WhatsApp" value={selected.whatsapp_number} />
              <Row label="Visa type" value={VISA_LABEL[selected.visa_type] || selected.visa_type} />
              <Row label="Input mode" value={selected.input_mode === "balance" ? "Exact balance" : "Earnings slider"} />
              {selected.super_balance != null && <Row label="Super balance" value={formatAUD(selected.super_balance)} />}
              {selected.gross_earnings != null && <Row label="Gross earnings" value={formatAUD(selected.gross_earnings)} />}
              <Row label="Estimated refund" value={<span className="font-display text-xl text-[#014E87]">{formatAUD(selected.estimated_refund)}</span>} />
              <Row label="Super fund" value={selected.super_fund_name || "—"} />
              <Row label="Date left AU" value={selected.date_left_australia || "—"} />
              {selected.referral_code && (
                <Row
                  label="Referral code"
                  value={<span className="font-mono text-[#014E87]" data-testid="modal-referral-code">{selected.referral_code}</span>}
                />
              )}
              {selected.referred_by_code && (
                <Row
                  label="Referred by"
                  value={<span className="font-mono text-[#014E87]" data-testid="modal-referred-by">{selected.referred_by_code}</span>}
                />
              )}
              <Row label="Status" value={
                <Badge variant="outline" className={`border ${statusBadgeClass(selected.status)}`}>
                  {statusLabel(selected.status)}
                </Badge>
              } />
              <Row label="Created" value={new Date(selected.created_at).toLocaleString("en-AU")} />

              <div className="pt-4 border-t border-[#E5E7EB]">
                <div className="text-xs uppercase tracking-[0.15em] text-[#475569] mb-2">
                  Move to stage
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_PIPELINE.map((s) => (
                    <button
                      key={s}
                      data-testid={`modal-status-${s}`}
                      onClick={() => updateStatus(selected, s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        selected.status === s
                          ? "bg-[#014E87] text-white border-[#014E87]"
                          : "bg-white border-[#E5E7EB] text-[#014E87] hover:border-[#014E87]"
                      }`}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs uppercase tracking-[0.12em] text-[#475569]">{label}</span>
      <span className="text-[#014E87]">{value}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      <AdminDashboardInner />
    </AdminGuard>
  );
}
