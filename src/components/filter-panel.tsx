"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Search, SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  search: string;
  niche: string;
  location: string;
  claimed: string;
  enrichmentStatus: string;
  ratingMin: string;
  ratingMax: string;
  usageStatus: string;
}

interface FilterOptions {
  niches: string[];
  locations: string[];
  claimed: string[];
  enrichmentStatus: string[];
}

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  fileId: string;
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

const FILTER_LABELS: Partial<Record<keyof FilterState, string>> = {
  niche: "Niche",
  location: "Location",
  claimed: "Claimed",
  enrichmentStatus: "Enrichment",
  ratingMin: "Min Rating",
  ratingMax: "Max Rating",
  usageStatus: "Usage",
};

export function FilterPanel({ filters, onChange, fileId }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState<FilterOptions>({
    niches: [],
    locations: [],
    claimed: [],
    enrichmentStatus: [],
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (fileId) params.set("fileId", fileId);
      const res = await fetch(`/api/leads/filters?${params}`);
      if (res.ok) setOptions(await res.json());
    }
    load();
  }, [fileId]);

  const handleSearchChange = useCallback(
    (val: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange({ ...filters, search: val }), 350);
    },
    [filters, onChange]
  );

  const setFilter = (key: keyof FilterState, val: string) =>
    onChange({ ...filters, [key]: val });

  const removeFilter = (key: keyof FilterState) => {
    if (key === "search" && searchRef.current) searchRef.current.value = "";
    onChange({ ...filters, [key]: "" });
  };

  const clearAll = () => {
    if (searchRef.current) searchRef.current.value = "";
    onChange(DEFAULT_FILTERS);
  };

  const activeFilterEntries = (Object.entries(filters) as [keyof FilterState, string][]).filter(
    ([k, v]) => k !== "search" && v !== ""
  );
  const hasActiveFilters = activeFilterEntries.length > 0;
  const hasAny = hasActiveFilters || !!filters.search;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-3 space-y-2.5">
        {/* Search + filter controls */}
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search business, phone, city, email, website…"
              defaultValue={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            />
            {filters.search && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 p-0.5 transition-colors"
                onClick={() => removeFilter("search")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-10 rounded-lg border text-sm font-medium transition-all whitespace-nowrap",
              expanded || hasActiveFilters
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-white/25 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterEntries.length}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
            )}
          </button>

          {/* Clear all */}
          {hasAny && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5">
            {activeFilterEntries.map(([key, val]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
              >
                <span className="text-blue-400 font-normal">{FILTER_LABELS[key] ?? key}:</span>
                {val}
                <button
                  onClick={() => removeFilter(key)}
                  className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Expanded filter grid */}
        {expanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2.5 border-t border-gray-100">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Niche</label>
              <Select value={filters.niche} onChange={(e) => setFilter("niche", e.target.value)}>
                <option value="">All niches</option>
                {options.niches.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</label>
              <Select value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
                <option value="">All locations</option>
                {options.locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Claimed</label>
              <Select value={filters.claimed} onChange={(e) => setFilter("claimed", e.target.value)}>
                <option value="">All</option>
                {options.claimed.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Enrichment</label>
              <Select value={filters.enrichmentStatus} onChange={(e) => setFilter("enrichmentStatus", e.target.value)}>
                <option value="">All</option>
                {options.enrichmentStatus.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Usage</label>
              <Select value={filters.usageStatus} onChange={(e) => setFilter("usageStatus", e.target.value)}>
                <option value="">All leads</option>
                <option value="used">Used (contacted)</option>
                <option value="unused">Unused (not contacted)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rating</label>
              <div className="flex gap-1.5 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={5}
                  step={0.1}
                  value={filters.ratingMin}
                  onChange={(e) => setFilter("ratingMin", e.target.value)}
                  className="w-[72px] text-xs"
                />
                <span className="text-gray-300">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={5}
                  step={0.1}
                  value={filters.ratingMax}
                  onChange={(e) => setFilter("ratingMax", e.target.value)}
                  className="w-[72px] text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
