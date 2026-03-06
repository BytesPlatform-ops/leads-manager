"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Drawer } from "@/components/ui/drawer";
import { ExternalLink, Copy, Check, Building2, Phone, Globe, Share2, Tag, Clock, PhoneCall, MessageSquare, ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Lead = Record<string, unknown>;

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  user: { email: string };
}

interface DispositionItem {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
  user: { email: string };
}

const DISPOSITION_OPTIONS = [
  { value: "NOT_CONTACTED", label: "Not Contacted", color: "bg-gray-100 text-gray-600" },
  { value: "CALL_ATTENDED", label: "Call Attended", color: "bg-green-100 text-green-700" },
  { value: "CALL_DECLINED", label: "Call Declined", color: "bg-red-100 text-red-700" },
  { value: "NO_ANSWER", label: "No Answer", color: "bg-yellow-100 text-yellow-700" },
  { value: "BUSY", label: "Busy", color: "bg-orange-100 text-orange-700" },
  { value: "WRONG_NUMBER", label: "Wrong Number", color: "bg-red-100 text-red-600" },
  { value: "CALL_BACK", label: "Call Back", color: "bg-blue-100 text-blue-700" },
  { value: "NOT_INTERESTED", label: "Not Interested", color: "bg-gray-200 text-gray-700" },
  { value: "INTERESTED", label: "Interested", color: "bg-emerald-100 text-emerald-700" },
  { value: "CONVERTED", label: "Converted", color: "bg-purple-100 text-purple-700" },
] as const;

const DISPOSITION_MAP = Object.fromEntries(DISPOSITION_OPTIONS.map((d) => [d.value, d]));

function dispositionBadge(status: string) {
  const d = DISPOSITION_MAP[status] ?? DISPOSITION_OPTIONS[0];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold", d.color)}>
      {d.label}
    </span>
  );
}

const SECTIONS = [
  {
    title: "Business",
    icon: Building2,
    fields: [
      { key: "business_name", label: "Business Name" },
      { key: "address", label: "Address" },
      { key: "city_state", label: "City / State" },
      { key: "search_niche", label: "Niche" },
      { key: "search_location", label: "Search Location" },
      { key: "rating", label: "Rating" },
      { key: "review_count", label: "Review Count" },
      { key: "claimed", label: "Claimed" },
    ],
  },
  {
    title: "Contact",
    icon: Phone,
    fields: [
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
    ],
  },
  {
    title: "Web & Social",
    icon: Globe,
    fields: [
      { key: "website_domain", label: "Website" },
      { key: "website_full", label: "Full URL" },
      { key: "facebook", label: "Facebook" },
      { key: "twitter", label: "Twitter" },
      { key: "linkedin", label: "LinkedIn" },
      { key: "instagram", label: "Instagram" },
    ],
  },
  {
    title: "Enrichment",
    icon: Tag,
    fields: [
      { key: "enrichment_status", label: "Status" },
      { key: "enriched_at", label: "Enriched At" },
    ],
  },
  {
    title: "Metadata",
    icon: Clock,
    fields: [
      { key: "scraped_at", label: "Scraped At" },
      { key: "detail_path", label: "Detail Path" },
    ],
  },
];

const URL_KEYS = new Set(["website_full", "website_domain", "facebook", "twitter", "linkedin", "instagram", "detail_path"]);
const COPY_KEYS = new Set(["phone", "email", "website_domain", "website_full"]);

interface LeadDetailDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange?: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="ml-2 shrink-0 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function FieldValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-300 italic text-sm">—</span>;
  }
  const str = String(value);
  if (URL_KEYS.has(fieldKey)) {
    const href = str.startsWith("http") ? str : `https://${str}`;
    return (
      <div className="flex items-center gap-1">
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all text-sm">
          {str}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
        {COPY_KEYS.has(fieldKey) && <CopyButton text={str} />}
      </div>
    );
  }
  if (fieldKey === "rating") {
    const num = parseFloat(str);
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-amber-500 text-base">{str}</span>
        <div className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < Math.round(num) ? "text-amber-400" : "text-gray-200"}>★</span>
          ))}
        </div>
      </div>
    );
  }
  if (fieldKey === "claimed") {
    const isYes = str.toLowerCase() === "true" || str.toLowerCase() === "yes";
    return (
      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold", isYes ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
        {isYes ? "✓ Claimed" : "✗ Unclaimed"}
      </span>
    );
  }
  if (fieldKey === "enrichment_status") {
    const s = str.toLowerCase();
    return (
      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
        s === "enriched" ? "bg-blue-100 text-blue-700" :
        s === "pending"  ? "bg-yellow-100 text-yellow-700" :
        "bg-gray-100 text-gray-500"
      )}>{str}</span>
    );
  }
  return (
    <div className="flex items-center">
      <span className="text-gray-900 break-words text-sm">{str}</span>
      {COPY_KEYS.has(fieldKey) && <CopyButton text={str} />}
    </div>
  );
}

export function LeadDetailDrawer({ lead, onClose, onStatusChange }: LeadDetailDrawerProps) {
  const { data: session } = useSession();
  const leadId = lead?.id as string | undefined;

  // --- Disposition state ---
  const [currentStatus, setCurrentStatus] = useState("NOT_CONTACTED");
  const [selectedStatus, setSelectedStatus] = useState("NOT_CONTACTED");
  const [dispNote, setDispNote] = useState("");
  const [dispositions, setDispositions] = useState<DispositionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dispLoading, setDispLoading] = useState(false);
  const [dispSaving, setDispSaving] = useState(false);

  // --- Notes state ---
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const fetchDispositions = useCallback(async (id: string) => {
    setDispLoading(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}/dispositions`);
      if (res.ok) {
        const data = await res.json();
        setDispositions(data.dispositions);
        setCurrentStatus(data.currentStatus);
        setSelectedStatus(data.currentStatus);
      }
    } catch { /* ignore */ }
    setDispLoading(false);
  }, []);

  const fetchNotes = useCallback(async (id: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes);
      }
    } catch { /* ignore */ }
    setNotesLoading(false);
  }, []);

  useEffect(() => {
    if (!leadId) return;
    // Reset state for new lead
    setCurrentStatus("NOT_CONTACTED");
    setSelectedStatus("NOT_CONTACTED");
    setDispNote("");
    setDispositions([]);
    setShowHistory(false);
    setNotes([]);
    setNoteContent("");

    fetchDispositions(leadId);
    fetchNotes(leadId);
  }, [leadId, fetchDispositions, fetchNotes]);

  const handleDispositionSubmit = async () => {
    if (!leadId || selectedStatus === currentStatus) return;
    setDispSaving(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/dispositions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, note: dispNote || undefined }),
      });
      if (res.ok) {
        setDispNote("");
        await fetchDispositions(leadId);
        onStatusChange?.();
      }
    } catch { /* ignore */ }
    setDispSaving(false);
  };

  const handleNoteSubmit = async () => {
    if (!leadId || !noteContent.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      if (res.ok) {
        const created: NoteItem = await res.json();
        setNotes((prev) => [created, ...prev]);
        setNoteContent("");
      }
    } catch { /* ignore */ }
    setNoteSaving(false);
  };

  if (!lead) return null;

  const extraFields = (lead.extraFields ?? {}) as Record<string, unknown>;
  const extraEntries = Object.entries(extraFields).filter(([, v]) => v !== "" && v !== null && v !== undefined);

  return (
    <Drawer open={!!lead} onClose={onClose} title={String(lead.business_name ?? "Lead Details")}>
      <div className="space-y-5">
        {/* File source badge */}
        {(lead.file as { originalName?: string } | undefined)?.originalName && (
          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <Share2 className="h-3 w-3" />
            {(lead.file as { originalName: string }).originalName}
          </div>
        )}

        {/* ===== Disposition Section ===== */}
        {session?.user && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
                <PhoneCall className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Call Disposition</h3>
              {dispositionBadge(currentStatus)}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex flex-col gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={dispLoading}
                >
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {selectedStatus !== currentStatus && (
                  <>
                    <input
                      type="text"
                      placeholder="Optional note (e.g., asked to call back at 3pm)..."
                      value={dispNote}
                      onChange={(e) => setDispNote(e.target.value)}
                      maxLength={500}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleDispositionSubmit}
                      disabled={dispSaving}
                      className="self-end inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {dispSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Update Status
                    </button>
                  </>
                )}
              </div>
              {/* History toggle */}
              {dispositions.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showHistory ? "Hide" : "Show"} history ({dispositions.length})
                  </button>
                  {showHistory && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {dispositions.map((d) => (
                        <div key={d.id} className="flex items-start gap-2 text-xs">
                          {dispositionBadge(d.status)}
                          <div className="flex-1 min-w-0">
                            {d.note && <p className="text-gray-600 truncate">{d.note}</p>}
                            <p className="text-gray-400">
                              <span className="font-medium text-gray-500">{d.user.email}</span>
                              <span className="mx-1">·</span>
                              {new Date(d.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Notes Section ===== */}
        {session?.user && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
                <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Notes {notes.length > 0 && <span className="text-gray-400 normal-case font-normal">({notes.length})</span>}
              </h3>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              {/* Add note form */}
              <div className="flex gap-2">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add a note..."
                  maxLength={2000}
                  rows={2}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <button
                  onClick={handleNoteSubmit}
                  disabled={noteSaving || !noteContent.trim()}
                  title="Add Note"
                  className="self-end shrink-0 p-2 rounded-lg text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {noteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {/* Notes list */}
              {notesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : notes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No notes yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notes.map((n) => (
                    <div key={n.id} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-gray-400">{n.user.email}</span>
                        <span className="text-[11px] text-gray-300">·</span>
                        <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        {SECTIONS.map(({ title, icon: Icon, fields }) => {
          const populated = fields.filter(({ key }) => {
            const v = lead[key];
            return v !== null && v !== undefined && v !== "";
          });
          if (populated.length === 0) return null;
          return (
            <div key={title} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
              </div>
              <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
                {populated.map(({ key, label }) => (
                  <div key={key} className="px-4 py-2.5 flex flex-col gap-0.5">
                    <span className="text-xs text-gray-400 font-medium">{label}</span>
                    <FieldValue fieldKey={key} value={lead[key]} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Extra fields */}
        {extraEntries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                <Tag className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Additional Fields</h3>
            </div>
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {extraEntries.map(([key, val]) => (
                <div key={key} className="px-4 py-2.5 flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 font-medium capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-gray-900 break-words text-sm">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
