"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Database, Settings2, X, MessageSquare } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const DISPOSITION_COLORS: Record<string, string> = {
  NOT_CONTACTED: "bg-gray-300",
  CALL_ATTENDED: "bg-green-500",
  CALL_DECLINED: "bg-red-500",
  NO_ANSWER: "bg-yellow-500",
  BUSY: "bg-orange-500",
  WRONG_NUMBER: "bg-red-400",
  CALL_BACK: "bg-blue-500",
  NOT_INTERESTED: "bg-gray-500",
  INTERESTED: "bg-emerald-500",
  CONVERTED: "bg-purple-500",
};

const DISPOSITION_LABELS: Record<string, string> = {
  NOT_CONTACTED: "Not Contacted",
  CALL_ATTENDED: "Call Attended",
  CALL_DECLINED: "Call Declined",
  NO_ANSWER: "No Answer",
  BUSY: "Busy",
  WRONG_NUMBER: "Wrong Number",
  CALL_BACK: "Call Back",
  NOT_INTERESTED: "Not Interested",
  INTERESTED: "Interested",
  CONVERTED: "Converted",
};

type Lead = Record<string, unknown>;

interface LeadsTableProps {
  data: Lead[];
  onRowClick: (lead: Lead) => void;
}

const CORE_COLUMNS: { key: string; label: string; width: number }[] = [
  { key: "business_name",    label: "Business",        width: 200 },
  { key: "phone",            label: "Phone",           width: 130 },
  { key: "city_state",       label: "City / State",    width: 150 },
  { key: "email",            label: "Email",           width: 200 },
  { key: "website_domain",   label: "Website",         width: 160 },
  { key: "rating",           label: "Rating",          width: 80  },
  { key: "review_count",     label: "Reviews",         width: 80  },
  { key: "claimed",          label: "Claimed",         width: 80  },
  { key: "search_niche",     label: "Niche",           width: 120 },
  { key: "search_location",  label: "Search Location", width: 140 },
  { key: "enrichment_status",label: "Enriched",        width: 100 },
];

function renderCoreCell(key: string, val: unknown) {
  if (val === null || val === undefined || val === "")
    return <span className="text-gray-300">—</span>;
  const str = String(val);
  if (key === "website_domain" || key === "website_full") {
    return (
      <a
        href={str.startsWith("http") ? str : `https://${str}`}
        target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:underline truncate block max-w-[140px]"
      >{str}</a>
    );
  }
  if (key === "rating") return <span className="font-medium text-amber-600">{str}</span>;
  if (key === "claimed") {
    const yes = str.toLowerCase() === "true" || str.toLowerCase() === "yes";
    return (
      <span className={cn("inline-flex px-1.5 py-0.5 rounded text-xs font-medium",
        yes ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
        {yes ? "Yes" : "No"}
      </span>
    );
  }
  if (key === "enrichment_status") {
    const s = str.toLowerCase();
    return (
      <span className={cn("inline-flex px-1.5 py-0.5 rounded text-xs font-medium",
        s === "enriched" ? "bg-blue-100 text-blue-700" :
        s === "pending"  ? "bg-yellow-100 text-yellow-700" :
        "bg-gray-100 text-gray-600")}>
        {str}
      </span>
    );
  }
  return <span className="truncate block max-w-[160px]" title={str}>{str}</span>;
}

export function LeadsTable({ data, onRowClick }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hiddenCoreKeys, setHiddenCoreKeys] = useState<Set<string>>(new Set());
  const [visibleExtraKeys, setVisibleExtraKeys] = useState<Set<string>>(new Set());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Auto-detect extra column keys from extraFields on current page
  const extraKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of data) {
      const ef = row.extraFields as Record<string, unknown> | null | undefined;
      if (ef && typeof ef === "object") Object.keys(ef).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [data]);

  // Close picker on outside click
  useEffect(() => {
    if (!colPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setColPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPickerOpen]);

  // Build TanStack column definitions
  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    // Indicator columns for disposition & notes
    const indicatorCols: ColumnDef<Lead>[] = [
      {
        id: "_status",
        header: "",
        size: 36,
        enableSorting: false,
        cell: ({ row }) => {
          const status = row.original._myDisposition as string | null;
          const isUsed = row.original._isUsed as boolean | undefined;
          const color = status ? DISPOSITION_COLORS[status] ?? "bg-gray-300" : undefined;
          
          // Show my disposition as a filled dot
          if (color) {
            return (
              <span
                title={DISPOSITION_LABELS[status!] ?? status!}
                className={cn("inline-block w-2.5 h-2.5 rounded-full", color)}
              />
            );
          }
          
          // Show "used by others" as an outline dot
          if (isUsed) {
            return (
              <span
                title="Used by others"
                className="inline-block w-2.5 h-2.5 rounded-full border-2 border-gray-400"
              />
            );
          }
          
          return null;
        },
      },
      {
        id: "_notes",
        header: "",
        size: 36,
        enableSorting: false,
        cell: ({ row }) => {
          const count = row.original._noteCount as number | undefined;
          if (!count) return null;
          return (
            <span className="inline-flex items-center gap-0.5 text-gray-400" title={`${count} note${count !== 1 ? "s" : ""}`}>
              <MessageSquare className="h-3 w-3" />
              <span className="text-[10px] font-medium">{count}</span>
            </span>
          );
        },
      },
    ];

    const core: ColumnDef<Lead>[] = CORE_COLUMNS
      .filter((col) => !hiddenCoreKeys.has(col.key))
      .map((col) => ({
        id: col.key,
        accessorKey: col.key,
        header: col.label,
        size: col.width,
        cell: ({ getValue }) => renderCoreCell(col.key, getValue()),
      }));

    const extra: ColumnDef<Lead>[] = extraKeys
      .filter((k) => visibleExtraKeys.has(k))
      .map((key) => ({
        id: `extra__${key}`,
        header: key.replace(/_/g, " "),
        size: 140,
        accessorFn: (row: Lead) => {
          const ef = row.extraFields as Record<string, unknown> | null | undefined;
          return ef?.[key] ?? "";
        },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          if (!v) return <span className="text-gray-300">—</span>;
          return <span className="truncate block max-w-[140px] capitalize" title={v}>{v}</span>;
        },
      }));

    return [...indicatorCols, ...core, ...extra];
  }, [hiddenCoreKeys, visibleExtraKeys, extraKeys]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: false,
  });

  const hiddenCount = hiddenCoreKeys.size;
  const extraShownCount = [...visibleExtraKeys].filter((k) => extraKeys.includes(k)).length;
  const totalCustomized = hiddenCount + extraShownCount;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between min-h-[28px]">
        <p className="text-xs text-gray-400">
          {extraKeys.length > 0
            ? `${extraKeys.length} extra column${extraKeys.length !== 1 ? "s" : ""} from this CSV — show them via Columns`
            : null}
        </p>

        {/* Column picker */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setColPickerOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors",
              totalCustomized > 0
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Columns
            {totalCustomized > 0 && (
              <span className="ml-0.5 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {totalCustomized}
              </span>
            )}
          </button>

          {colPickerOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-30 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Column Visibility</span>
                <button onClick={() => setColPickerOpen(false)} className="text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 p-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Core columns */}
              <div className="p-3 max-h-56 overflow-y-auto">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-1 mb-1.5">
                  Core Fields
                </p>
                {CORE_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!hiddenCoreKeys.has(col.key)}
                      onChange={(e) => {
                        setHiddenCoreKeys((prev) => {
                          const next = new Set(prev);
                          e.target.checked ? next.delete(col.key) : next.add(col.key);
                          return next;
                        });
                      }}
                      className="rounded accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>

              {/* Extra columns from CSV */}
              {extraKeys.length > 0 && (
                <div className="border-t border-gray-100 p-3 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      Extra Fields (from CSV)
                    </p>
                    <button
                      onClick={() => setVisibleExtraKeys(new Set(extraKeys))}
                      className="text-[10px] text-blue-600 hover:underline font-medium"
                    >
                      Show all
                    </button>
                  </div>
                  {extraKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={visibleExtraKeys.has(key)}
                        onChange={(e) => {
                          setVisibleExtraKeys((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(key) : next.delete(key);
                            return next;
                          });
                        }}
                        className="rounded accent-blue-600"
                      />
                      <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Reset */}
              {totalCustomized > 0 && (
                <div className="border-t border-gray-100 px-4 py-2.5">
                  <button
                    onClick={() => { setHiddenCoreKeys(new Set()); setVisibleExtraKeys(new Set()); }}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    ↺ Reset to defaults
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-200 sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ minWidth: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ChevronUp className="h-3 w-3 text-blue-500" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ChevronDown className="h-3 w-3 text-blue-500" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 text-gray-300" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Database className="h-6 w-6 text-gray-300" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-500">No leads found</p>
                      <p className="text-xs mt-0.5">Try adjusting your search or filters</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    idx % 2 === 0 ? "bg-white hover:bg-blue-50/70" : "bg-gray-50/40 hover:bg-blue-50/70"
                  )}
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
