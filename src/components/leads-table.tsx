"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Database, MessageSquare } from "lucide-react";
import { useState, useMemo } from "react";
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
  loading?: boolean;
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

export function LeadsTable({ data, onRowClick, loading = false }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Auto-detect extra column keys from extraFields on current page
  const extraKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of data) {
      const ef = row.extraFields as Record<string, unknown> | null | undefined;
      if (ef && typeof ef === "object") Object.keys(ef).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [data]);

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

    const core: ColumnDef<Lead>[] = CORE_COLUMNS.map((col) => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      size: col.width,
      cell: ({ getValue }) => renderCoreCell(col.key, getValue()),
    }));

    const extra: ColumnDef<Lead>[] = extraKeys.map((key) => ({
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
  }, [extraKeys]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: false,
  });

  return (
    <div className="space-y-2 min-w-0">
      {/* Info bar */}
      {extraKeys.length > 0 && (
        <div className="flex items-center gap-2 min-h-[28px]">
          <p className="text-xs text-gray-500">
            Showing {CORE_COLUMNS.length} core columns + {extraKeys.length} extra field{extraKeys.length !== 1 ? "s" : ""} from this CSV
          </p>
        </div>
      )}

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
                  {loading ? (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Loading leads...</p>
                        <p className="text-xs mt-0.5">Please wait while we fetch your data</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <Database className="h-6 w-6 text-gray-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">No leads found</p>
                        <p className="text-xs mt-0.5">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  )}
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
