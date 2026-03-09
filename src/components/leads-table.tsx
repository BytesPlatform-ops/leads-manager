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

// Fields to exclude from display (internal/system fields)
const HIDDEN_FIELDS = new Set([
  "id", "fileId", "file", "extraFields", "notes", "dispositions",
  "_myDisposition", "_isUsed", "_noteCount", "createdAt", "updatedAt"
]);

// Fields that get special rendering
const LINK_FIELDS = new Set(["website_domain", "website_full", "facebook", "twitter", "linkedin", "instagram"]);

function formatHeader(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function renderCell(key: string, val: unknown) {
  if (val === null || val === undefined || val === "")
    return <span className="text-gray-300">—</span>;
  
  const str = String(val);
  
  // Links (websites, social media)
  if (LINK_FIELDS.has(key)) {
    const url = str.startsWith("http") ? str : `https://${str}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:underline truncate block max-w-[160px]"
      >
        {str}
      </a>
    );
  }
  
  return <span className="truncate block max-w-[180px]" title={str}>{str}</span>;
}

export function LeadsTable({ data, onRowClick, loading = false }: LeadsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Auto-detect ALL column keys from the data that have at least one non-empty value
  const allColumnKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of data) {
      // Get direct fields from the lead object - only add if value is non-empty
      Object.entries(row).forEach(([k, v]) => {
        if (!HIDDEN_FIELDS.has(k) && v !== null && v !== undefined && v !== "") {
          keys.add(k);
        }
      });
      // Get extra fields from extraFields JSON - only add if value is non-empty
      const ef = row.extraFields as Record<string, unknown> | null | undefined;
      if (ef && typeof ef === "object") {
        Object.entries(ef).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") {
            keys.add(`extra:${k}`);
          }
        });
      }
    }
    return Array.from(keys);
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

    // Dynamic columns from data
    const dynamicCols: ColumnDef<Lead>[] = allColumnKeys.map((key) => {
      const isExtra = key.startsWith("extra:");
      const actualKey = isExtra ? key.slice(6) : key;
      
      return {
        id: key,
        header: formatHeader(actualKey),
        size: 150,
        accessorFn: (row: Lead) => {
          if (isExtra) {
            const ef = row.extraFields as Record<string, unknown> | null | undefined;
            return ef?.[actualKey] ?? "";
          }
          return row[key] ?? "";
        },
        cell: ({ getValue }) => renderCell(actualKey, getValue()),
      };
    });

    return [...indicatorCols, ...dynamicCols];
  }, [allColumnKeys]);

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
