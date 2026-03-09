"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface CsvFile {
  id: string;
  originalName: string;
  rowCount: number;
  uploadedAt: string;
  uploader?: { email: string };
}

interface UploadState {
  status: "idle" | "parsing" | "uploading" | "done" | "error";
  message: string;
  preview?: { name: string; rows: number; cols: string[] };
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [upload, setUpload] = useState<UploadState>({ status: "idle", message: "" });
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    const res = await fetch("/api/admin/files");
    if (res.ok) {
      const data = await res.json();
      setFiles(data);
    }
    setLoading(false);
  }

  useEffect(() => { loadFiles(); }, []);

  function previewFile(file: File) {
    const isCSV = file.name.toLowerCase().endsWith(".csv");
    const isXLSX = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    
    if (!isCSV && !isXLSX) {
      setUpload({ status: "error", message: "Only CSV and Excel (.xlsx, .xls) files are accepted" });
      return;
    }
    
    setUpload({ status: "parsing", message: `Parsing ${isXLSX ? "Excel" : "CSV"} file…` });
    
    if (isXLSX) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });
          
          if (jsonData.length < 2) {
            setUpload({ status: "error", message: "Excel file has no data rows" });
            return;
          }
          
          const cols = (jsonData[0] as string[]).map(h => String(h).trim()).filter(Boolean);
          const rows = jsonData.slice(1).filter((row: string[]) => row.some(cell => String(cell).trim())).length;
          
          setUpload({
            status: "idle",
            message: "",
            preview: { name: file.name, rows, cols },
          });
          setPendingFile(file);
          setCustomName(file.name.replace(/\.(xlsx|xls)$/i, ""));
        } catch {
          setUpload({ status: "error", message: "Failed to parse Excel file" });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const cols = lines[0]?.split(",").map((c) => c.replace(/"/g, "").trim()) ?? [];
        setUpload({
          status: "idle",
          message: "",
          preview: { name: file.name, rows: lines.length - 1, cols },
        });
        setPendingFile(file);
        setCustomName(file.name.replace(/\.csv$/i, ""));
      };
      reader.readAsText(file);
    }
  }

  async function handleUpload() {
    if (!pendingFile) return;
    const label = customName.trim() || pendingFile.name;
    setUpload({ status: "uploading", message: `Uploading "${label}"…` });
    const form = new FormData();
    form.append("file", pendingFile);
    if (customName.trim()) form.append("customName", customName.trim());
    const res = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setUpload({ status: "done", message: `✓ Uploaded ${data.rowCount.toLocaleString()} rows from "${data.name}"` });
      setPendingFile(null);
      await loadFiles();
    } else {
      setUpload({ status: "error", message: data.error ?? "Upload failed" });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its leads? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) previewFile(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) previewFile(file);
    e.target.value = "";
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <div className="h-8 w-32 skeleton mb-2"></div>
          <div className="h-4 w-96 skeleton"></div>
        </div>
        
        {/* Upload card skeleton */}
        <div className="h-96 skeleton rounded-lg"></div>
        
        {/* Files list skeleton */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="h-16 bg-gray-50 border-b border-gray-200"></div>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-3">
                <div className="h-10 w-10 skeleton rounded-xl shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 skeleton"></div>
                  <div className="h-3 w-64 skeleton"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Files</h1>
        <p className="text-sm text-gray-500 mt-1">Upload CSV or Excel files to populate leads. Each file is stored separately and remains accessible from the dashboard.</p>
      </div>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Drop a CSV or Excel file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Accepts .csv, .xlsx, and .xls files</p>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={onFileInput} />
          </div>

          {/* Preview */}
          {upload.preview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">{upload.preview.name}</p>
                  <p className="text-blue-700">{upload.preview.rows.toLocaleString()} rows · {upload.preview.cols.length} columns</p>
                </div>
              </div>

              {/* Custom display name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-blue-800">
                  Display name <span className="font-normal text-blue-500">(optional — shown in dashboard &amp; file list)</span>
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={upload.preview.name.replace(/\.csv$/i, "")}
                  maxLength={200}
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {upload.preview.cols.slice(0, 15).map((c) => (
                  <span key={c} className="bg-white border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded">{c}</span>
                ))}
                {upload.preview.cols.length > 15 && (
                  <span className="text-blue-600 text-xs px-2 py-0.5">+{upload.preview.cols.length - 15} more</span>
                )}
              </div>
              <Button onClick={handleUpload} className="mt-2 gap-2" disabled={upload.status === "uploading"}>
                {upload.status === "uploading" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="h-4 w-4" /> Upload {upload.preview.rows.toLocaleString()} rows</>
                )}
              </Button>
            </div>
          )}

          {/* Status messages */}
          {upload.status === "done" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <CheckCircle className="h-4 w-4" />
              {upload.message}
            </div>
          )}
          {upload.status === "error" && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <AlertCircle className="h-4 w-4" />
              {upload.message}
            </div>
          )}
          {upload.status === "parsing" && (
            <p className="text-sm text-gray-500">{upload.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Uploaded files list */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {files.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Upload className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No files uploaded yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload a CSV file above to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-gray-50 gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.originalName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="font-medium text-gray-600">{f.rowCount.toLocaleString()}</span> rows
                        {" · "}{new Date(f.uploadedAt).toLocaleDateString()}
                        {f.uploader?.email && <>{" · "}{f.uploader.email}</>}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(f.id, f.originalName)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
