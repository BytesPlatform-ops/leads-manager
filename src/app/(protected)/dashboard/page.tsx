"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { LeadsTable } from "@/components/leads-table";
import { FilterPanel, FilterState } from "@/components/filter-panel";
import { LeadDetailDrawer } from "@/components/lead-detail-drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Layers, FileText } from "lucide-react";

type Lead = Record<string, unknown>;

interface CsvFile {
  id: string;
  originalName: string;
  rowCount: number;
  uploadedAt: string;
}

interface ApiResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  niche: "",
  location: "",
  claimed: "",
  enrichmentStatus: "",
  ratingMin: "",
  ratingMax: "",
  usageStatus: "",
};

export default function DashboardPage() {
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>(""); // "" = all files
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load file list
  useEffect(() => {
    fetch("/api/admin/files")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setFiles(d); })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async (currentPage: number) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (selectedFileId) params.set("fileId", selectedFileId);
      if (filters.search) params.set("search", filters.search);
      if (filters.niche) params.set("niche", filters.niche);
      if (filters.location) params.set("location", filters.location);
      if (filters.claimed) params.set("claimed", filters.claimed);
      if (filters.enrichmentStatus) params.set("enrichmentStatus", filters.enrichmentStatus);
      if (filters.ratingMin) params.set("ratingMin", filters.ratingMin);
      if (filters.ratingMax) params.set("ratingMax", filters.ratingMax);
      if (filters.usageStatus) params.set("usageStatus", filters.usageStatus);
      params.set("page", String(currentPage));
      params.set("limit", String(limit));

      const res = await fetch(`/api/leads?${params}`, { signal: abortRef.current.signal });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[Dashboard] Failed to fetch leads:", res.status, errorData);
        throw new Error(errorData.error || "Failed to fetch leads");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error("[Dashboard] Error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedFileId, filters, limit]);

  useEffect(() => {
    setPage(1);
    fetchLeads(1);
  }, [selectedFileId, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
    fetchLeads(1);
  }, [limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLeads(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiltersChange = useCallback((f: FilterState) => {
    setFilters(f);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.total.toLocaleString()} record{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* File selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-gray-500 shrink-0">Source file:</span>
          <Select
            value={selectedFileId}
            onChange={(e) => { setSelectedFileId(e.target.value); setPage(1); }}
            className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[280px]"
          >
            <option value="">
              All Files {files.length > 0 ? `(${files.length})` : ""}
            </option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.originalName} ({f.rowCount.toLocaleString()})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      {(data || files.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm text-xs sm:text-sm overflow-x-auto">
          <span className="text-gray-400">
            <span className="font-semibold text-gray-700">{data ? data.total.toLocaleString() : "—"}</span>
            {" "}records
          </span>
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span className="text-gray-400">
            <span className="font-semibold text-gray-700">{files.length}</span>
            {" "}file{files.length !== 1 ? "s" : ""}
          </span>
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span className="text-gray-400">
            Page{" "}
            <span className="font-semibold text-gray-700">{data ? `${data.page} / ${data.pages}` : "—"}</span>
          </span>
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5 text-gray-400">
            Rows per page:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="font-semibold text-gray-700 bg-transparent border-none outline-none cursor-pointer"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </span>
        </div>
      )}

      {/* File chips (quick access) */}
      {files.length > 0 && (
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => { setSelectedFileId(""); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
              selectedFileId === ""
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            All Files
          </button>
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => { setSelectedFileId(f.id); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                selectedFileId === f.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {f.originalName}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <FilterPanel filters={filters} onChange={handleFiltersChange} fileId={selectedFileId} />

      {/* Table */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 z-20 overflow-hidden rounded-full">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: "60%", marginLeft: "20%" }} />
          </div>
        )}
        <div className={loading ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
          <LeadsTable
            data={data?.leads ?? []}
            onRowClick={(lead) => setSelectedLead(lead)}
          />
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages >= 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-500">
              Page {data.page} of {data.pages} · {data.total.toLocaleString()} total
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 whitespace-nowrap">Rows per page:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, data.pages - 4));
              const p = start + i;
              if (p > data.pages) return null;
              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                  className="w-9"
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={() => fetchLeads(page)}
      />
    </div>
  );
}
