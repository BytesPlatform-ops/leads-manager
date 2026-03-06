"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  BarChart3,
  Users,
  FileText,
  Target,
  TrendingUp,
  TrendingDown,
  Phone,
  MapPin,
  Star,
  Activity,
  Zap,
  Award,
  Briefcase,
  RefreshCw,
  X,
  Filter,
  ChevronRight,
  Clock,
  UserCheck,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface AnalyticsData {
  overview: {
    totalLeads: number;
    totalFiles: number;
    totalUsers: number;
    totalNotes: number;
    contactedLeads: number;
    contactRate: string;
    conversionCount: number;
    conversionRate: string;
    thisWeekDispositions: number;
    weeklyChange: string;
  };
  dispositions: { status: string; count: number; label: string }[];
  niches: { niche: string; count: number }[];
  locations: { location: string; count: number }[];
  ratings: { bucket: string; count: number }[];
  activity: { date: string; notes: number; dispositions: number }[];
  userPerformance: {
    userId: string;
    email: string;
    role: string;
    notes: number;
    dispositions: number;
    conversions: number;
    interested: number;
    lastActive: string | null;
  }[];
  funnel: { stage: string; count: number }[];
  enrichment: { status: string; count: number }[];
  topRatedLeads: {
    id: string;
    business_name: string;
    rating: number;
    review_count: number;
    city_state: string;
    search_niche: string;
  }[];
  recentFiles: {
    id: string;
    name: string;
    uploadedAt: string;
    rowCount: number;
    uploadedBy: string;
    leadCount: number;
  }[];
  filters: {
    files: { id: string; name: string }[];
    niches: string[];
    locations: string[];
    users: { id: string; email: string; role: string }[];
  };
}

interface Filters {
  period: string;
  fileId: string;
  niche: string;
  location: string;
  userId: string;
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const DISPOSITION_COLORS: Record<string, string> = {
  NOT_CONTACTED: "#9ca3af",
  CALL_ATTENDED: "#3b82f6",
  CALL_DECLINED: "#ef4444",
  NO_ANSWER: "#f59e0b",
  BUSY: "#f97316",
  WRONG_NUMBER: "#dc2626",
  CALL_BACK: "#8b5cf6",
  NOT_INTERESTED: "#64748b",
  INTERESTED: "#10b981",
  CONVERTED: "#059669",
};

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
  color = "blue",
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  subtitle?: string;
  color?: "blue" | "green" | "amber" | "purple" | "red";
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <Card
      className={`relative overflow-hidden ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {(trend || subtitle) && (
              <div className="flex items-center gap-1.5">
                {trend && trendValue && (
                  <span
                    className={`flex items-center text-xs font-medium ${
                      trend === "up"
                        ? "text-emerald-600"
                        : trend === "down"
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {trend === "up" ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : trend === "down" ? (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    ) : null}
                    {trendValue}
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-gray-400">{subtitle}</span>
                )}
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    period: "30d",
    fileId: "",
    niche: "",
    location: "",
    userId: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AnalyticsData["userPerformance"][0] | null>(null);

  const buildQuery = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    if (f.period) p.set("period", f.period);
    if (f.fileId) p.set("fileId", f.fileId);
    if (f.niche) p.set("niche", f.niche);
    if (f.location) p.set("location", f.location);
    if (f.userId) p.set("userId", f.userId);
    return p.toString();
  }, []);

  const loadAnalytics = useCallback(async (f: Filters) => {
    const qs = buildQuery(f);
    const res = await fetch(`/api/admin/analytics?${qs}`);
    if (res.ok) setData(await res.json());
  }, [buildQuery]);

  async function refresh() {
    setRefreshing(true);
    await loadAnalytics(filters);
    setRefreshing(false);
  }

  useEffect(() => {
    loadAnalytics(filters).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters(newFilters: Partial<Filters>) {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    setRefreshing(true);
    loadAnalytics(updated).finally(() => setRefreshing(false));
  }

  function clearFilters() {
    const cleared: Filters = { period: "30d", fileId: "", niche: "", location: "", userId: "" };
    setFilters(cleared);
    setSelectedUser(null);
    setRefreshing(true);
    loadAnalytics(cleared).finally(() => setRefreshing(false));
  }

  const activeFilterCount = [filters.fileId, filters.niche, filters.location, filters.userId].filter(Boolean).length 
    + (filters.period !== "30d" ? 1 : 0);

  function viewUserDetail(user: AnalyticsData["userPerformance"][0]) {
    setSelectedUser(user);
    applyFilters({ userId: user.userId });
  }

  function exitUserView() {
    setSelectedUser(null);
    applyFilters({ userId: "" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load analytics data.
      </div>
    );
  }

  const weeklyTrend =
    parseFloat(data.overview.weeklyChange) > 0
      ? "up"
      : parseFloat(data.overview.weeklyChange) < 0
      ? "down"
      : "neutral";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedUser && (
            <button
              onClick={exitUserView}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedUser ? `${selectedUser.email}` : "Analytics Dashboard"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {selectedUser
                ? `Individual performance · ${selectedUser.role}`
                : "Real-time insights into your leads and team performance"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Period quick select */}
          <Select
            value={filters.period}
            onChange={(e) => applyFilters({ period: e.target.value })}
            className="h-9 w-36 text-sm"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}

          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">File</label>
                <Select
                  value={filters.fileId}
                  onChange={(e) => applyFilters({ fileId: e.target.value })}
                  className="h-9 text-sm"
                >
                  <option value="">All Files</option>
                  {data.filters.files.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Niche</label>
                <Select
                  value={filters.niche}
                  onChange={(e) => applyFilters({ niche: e.target.value })}
                  className="h-9 text-sm"
                >
                  <option value="">All Niches</option>
                  {data.filters.niches.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</label>
                <Select
                  value={filters.location}
                  onChange={(e) => applyFilters({ location: e.target.value })}
                  className="h-9 text-sm"
                >
                  <option value="">All Locations</option>
                  {data.filters.locations.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">User</label>
                <Select
                  value={filters.userId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    if (uid) {
                      const u = data.userPerformance.find((u) => u.userId === uid);
                      if (u) setSelectedUser(u);
                    } else {
                      setSelectedUser(null);
                    }
                    applyFilters({ userId: uid });
                  }}
                  className="h-9 text-sm"
                >
                  <option value="">All Users</option>
                  {data.filters.users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                  ))}
                </Select>
              </div>
            </div>
            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                {filters.period !== "30d" && (
                  <FilterTag label={PERIOD_OPTIONS.find((p) => p.value === filters.period)?.label ?? filters.period} onRemove={() => applyFilters({ period: "30d" })} />
                )}
                {filters.fileId && (
                  <FilterTag label={`File: ${data.filters.files.find((f) => f.id === filters.fileId)?.name ?? "..."}`} onRemove={() => applyFilters({ fileId: "" })} />
                )}
                {filters.niche && (
                  <FilterTag label={`Niche: ${filters.niche}`} onRemove={() => applyFilters({ niche: "" })} />
                )}
                {filters.location && (
                  <FilterTag label={`Location: ${filters.location}`} onRemove={() => applyFilters({ location: "" })} />
                )}
                {filters.userId && (
                  <FilterTag label={`User: ${data.filters.users.find((u) => u.id === filters.userId)?.email ?? "..."}`} onRemove={() => { setSelectedUser(null); applyFilters({ userId: "" }); }} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spinner overlay */}
      {refreshing && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Updating...
          </div>
        </div>
      )}

      {/* User Detail Card (when user is selected) */}
      {selectedUser && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Role</p>
                <p className={`text-sm font-semibold mt-1 ${selectedUser.role === "ADMIN" ? "text-purple-700" : "text-emerald-700"}`}>
                  {selectedUser.role}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Dispositions</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{selectedUser.dispositions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Notes Added</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{selectedUser.notes.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Conversions</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">{selectedUser.conversions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Last Active</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {selectedUser.lastActive
                    ? format(new Date(selectedUser.lastActive), "MMM d, yyyy h:mm a")
                    : "Never"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Leads"
          value={data.overview.totalLeads.toLocaleString()}
          icon={Briefcase}
          color="blue"
        />
        <StatCard
          title="Contact Rate"
          value={`${data.overview.contactRate}%`}
          icon={Phone}
          subtitle={`${data.overview.contactedLeads.toLocaleString()} contacted`}
          color="amber"
        />
        <StatCard
          title="Conversions"
          value={data.overview.conversionCount}
          icon={Target}
          subtitle={`${data.overview.conversionRate}% rate`}
          color="green"
        />
        <StatCard
          title="Period Activity"
          value={data.overview.thisWeekDispositions}
          icon={Activity}
          trend={weeklyTrend}
          trendValue={`${data.overview.weeklyChange}%`}
          color="purple"
        />
        <StatCard
          title="Team Size"
          value={data.overview.totalUsers}
          icon={Users}
          subtitle={`${data.overview.totalNotes} notes`}
          color="blue"
        />
      </div>

      {/* Conversion Funnel & Disposition Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString(), "Leads"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Funnel
                    dataKey="count"
                    data={data.funnel}
                    isAnimationActive
                  >
                    <LabelList
                      position="center"
                      fill="#fff"
                      stroke="none"
                      dataKey="stage"
                      style={{ fontSize: 12, fontWeight: 500 }}
                    />
                    {data.funnel.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {data.funnel.map((stage, i) => (
                <div key={stage.stage} className="text-center">
                  <div
                    className="text-lg font-bold"
                    style={{ color: COLORS[i % COLORS.length] }}
                  >
                    {stage.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">{stage.stage}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disposition Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Disposition Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.dispositions}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="label"
                  >
                    {data.dispositions.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={DISPOSITION_COLORS[entry.status] || "#9ca3af"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value).toLocaleString(),
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            7-Day Activity Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.activity}>
                <defs>
                  <linearGradient id="colorNotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDispositions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600 capitalize">{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="notes"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNotes)"
                />
                <Area
                  type="monotone"
                  dataKey="dispositions"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDispositions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Niches & Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Niches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Top Business Niches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.niches} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="niche"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    width={120}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString(), "Leads"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(_data, _idx, e) => {
                      const payload = (_data as unknown as { niche?: string });
                      if (payload?.niche) applyFilters({ niche: payload.niche });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              Top Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.locations} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="location"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    width={120}
                  />
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString(), "Leads"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(_data, _idx, e) => {
                      const payload = (_data as unknown as { location?: string });
                      if (payload?.location) applyFilters({ location: payload.location });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ratings & Enrichment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Rating Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ratings}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip
                    formatter={(value) => [Number(value).toLocaleString(), "Leads"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.ratings.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.bucket.includes("4.5")
                            ? "#059669"
                            : entry.bucket.includes("4.0")
                            ? "#10b981"
                            : entry.bucket.includes("3.5")
                            ? "#f59e0b"
                            : entry.bucket.includes("3.0")
                            ? "#f97316"
                            : entry.bucket.includes("2.0")
                            ? "#ef4444"
                            : "#9ca3af"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Enrichment Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-600" />
              Enrichment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.enrichment}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    nameKey="status"
                    label={({ name, percent }) =>
                      `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {data.enrichment.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value).toLocaleString(),
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-600" />
            Team Performance Leaderboard
            <span className="text-xs font-normal text-gray-400 ml-1">Click a row to drill down</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dispositions
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Interested
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Conversions
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Conv. Rate
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.userPerformance.map((user, idx) => (
                  <tr
                    key={user.userId}
                    onClick={() => viewUserDetail(user)}
                    className={`border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer ${
                      selectedUser?.userId === user.userId ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          idx === 0
                            ? "bg-amber-100 text-amber-700"
                            : idx === 1
                            ? "bg-gray-200 text-gray-700"
                            : idx === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-900">
                        {user.email}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm text-gray-600">
                        {user.dispositions.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm text-gray-600">
                        {user.notes.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.interested}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {user.conversions}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm text-gray-600">
                        {user.dispositions > 0
                          ? `${((user.conversions / user.dispositions) * 100).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs text-gray-500">
                        {user.lastActive
                          ? format(new Date(user.lastActive), "MMM d")
                          : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Rated Leads & Recent Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rated Leads */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Top Rated Leads (4.5+ with 50+ reviews)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topRatedLeads.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No leads match the criteria yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {data.topRatedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {lead.business_name || "Unnamed Business"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {lead.city_state} · {lead.search_niche}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          {lead.rating}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {lead.review_count} reviews
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Files */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentFiles.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No files uploaded yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {data.recentFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => applyFilters({ fileId: file.id })}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      filters.fileId === file.id ? "bg-blue-50 ring-1 ring-blue-200" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(file.uploadedAt), "MMM d, yyyy")} ·{" "}
                        {file.uploadedBy}
                      </p>
                    </div>
                    <div className="shrink-0 ml-4 text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {file.rowCount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">leads</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
