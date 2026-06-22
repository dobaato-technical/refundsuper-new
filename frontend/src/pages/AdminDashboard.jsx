import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, TrendingUp, DollarSign, Trophy, LogOut, Search,
  Download, RefreshCw, ChevronDown,
} from "lucide-react";
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

const VISA_LABEL = {
  working_holiday: "Working Holiday",
  other_temp: "Student / Other",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
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
      const [statsResp, leadsResp] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/leads", { params }),
      ]);
      setStats(statsResp.data);
      setLeads(leadsResp.data.leads);
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
    navigate("/admin/login");
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

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: Users, label: "Total leads", value: stats.total_leads, accent: "bg-[#FFF6F2] text-[#E05D43]" },
      { icon: DollarSign, label: "Pipeline value", value: formatAUD(stats.pipeline_value), accent: "bg-[#E7EEF4] text-[#0B2B40]" },
      { icon: Trophy, label: "Recovered", value: formatAUD(stats.recovered_value), accent: "bg-[#E6EFD8] text-[#2E7D32]" },
      { icon: TrendingUp, label: "Conversion", value: `${stats.conversion_rate}%`, accent: "bg-[#FFF4DC] text-[#7A5A12]" },
    ];
  }, [stats]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#0B2B40]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#E8E6E1] sticky top-0 z-30">
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="admin-logo">
            <div className="h-9 w-9 rounded-lg bg-[#E05D43] flex items-center justify-center text-white font-display font-semibold">
              A
            </div>
            <div>
              <div className="font-display font-medium text-[#0B2B40] leading-none">
                AussieBack
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#4A5D68] mt-0.5">
                Admin console
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#4A5D68] hidden md:inline">
              {getAdminEmail()}
            </span>
            <Button
              data-testid="logout-btn"
              variant="outline"
              onClick={logout}
              className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
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
            <p className="text-[#4A5D68] mt-1">
              Manage incoming refund estimates and move them through to payout.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="refresh-btn"
              onClick={load}
              variant="outline"
              className="border-2 border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button
              data-testid="export-btn"
              onClick={exportCsv}
              className="bg-[#0B2B40] hover:bg-[#082030] text-white"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="bg-white border border-[#E8E6E1] rounded-xl p-5 flex items-start gap-4 hover:-translate-y-0.5 transition-transform"
              >
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${s.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68] mb-1">
                    {s.label}
                  </div>
                  <div className="font-display text-2xl font-medium">{s.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 bg-[#FAFAF9] border border-[#E8E6E1] rounded-lg px-3">
            <Search className="h-4 w-4 text-[#4A5D68]" />
            <Input
              data-testid="search-input"
              placeholder="Search name, email, WhatsApp, fund..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
            />
            <Button type="submit" size="sm" className="bg-[#0B2B40] hover:bg-[#082030] text-white h-8" data-testid="search-btn">
              Search
            </Button>
          </form>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-64 bg-[#FAFAF9] border-[#E8E6E1] h-12" data-testid="status-filter">
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

        {/* Table */}
        <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="leads-table">
              <thead>
                <tr className="border-b border-[#E8E6E1] bg-[#FAFAF9] text-left text-[11px] uppercase tracking-[0.15em] text-[#4A5D68]">
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
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[#4A5D68]">Loading...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[#4A5D68]" data-testid="empty-leads">
                    No leads yet. Submit an estimate from the landing page to see one here.
                  </td></tr>
                ) : (
                  leads.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#E8E6E1] hover:bg-[#FAFAF9] transition-colors cursor-pointer"
                      onClick={() => setSelected(l)}
                      data-testid={`lead-row-${l.id}`}
                    >
                      <td className="px-5 py-4 font-medium text-[#0B2B40]">{l.first_name}</td>
                      <td className="px-5 py-4 text-[#4A5D68]">
                        <div>{l.email}</div>
                        <div className="text-xs">{l.whatsapp_number}</div>
                      </td>
                      <td className="px-5 py-4 text-[#4A5D68]">{VISA_LABEL[l.visa_type] || l.visa_type}</td>
                      <td className="px-5 py-4 text-right font-display font-medium text-[#0B2B40]">
                        {formatAUD(l.estimated_refund)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="outline" className={`border ${statusBadgeClass(l.status)}`}>
                          {statusLabel(l.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-[#4A5D68] text-xs">
                        {new Date(l.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-[#E8E6E1]" data-testid={`status-menu-${l.id}`}>
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

      {/* Lead detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg bg-white" data-testid="lead-detail-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-[#0B2B40]">
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
              <Row label="Estimated refund" value={<span className="font-display text-xl text-[#E05D43]">{formatAUD(selected.estimated_refund)}</span>} />
              <Row label="Super fund" value={selected.super_fund_name || "—"} />
              <Row label="Date left AU" value={selected.date_left_australia || "—"} />
              <Row label="Status" value={
                <Badge variant="outline" className={`border ${statusBadgeClass(selected.status)}`}>
                  {statusLabel(selected.status)}
                </Badge>
              } />
              <Row label="Created" value={new Date(selected.created_at).toLocaleString("en-AU")} />

              <div className="pt-4 border-t border-[#E8E6E1]">
                <div className="text-xs uppercase tracking-[0.15em] text-[#4A5D68] mb-2">
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
                          ? "bg-[#0B2B40] text-white border-[#0B2B40]"
                          : "bg-white border-[#E8E6E1] text-[#0B2B40] hover:border-[#0B2B40]"
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
      <span className="text-xs uppercase tracking-[0.12em] text-[#4A5D68]">{label}</span>
      <span className="text-[#0B2B40]">{value}</span>
    </div>
  );
}
