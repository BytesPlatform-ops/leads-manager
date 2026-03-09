import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const KNOWN_FIELDS = new Set([
  "business_name", "phone", "address", "city_state", "rating",
  "review_count", "website_domain", "claimed", "detail_path",
  "search_niche", "search_location", "scraped_at", "email",
  "website_full", "facebook", "twitter", "linkedin", "instagram",
  "enrichment_status", "enriched_at",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const isCSV = file.name.toLowerCase().endsWith(".csv");
  const isXLSX = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
  
  if (!isCSV && !isXLSX) {
    return NextResponse.json({ error: "Only CSV and Excel (.xlsx, .xls) files are accepted" }, { status: 400 });
  }

  const rawCustomName = (formData.get("customName") as string | null)?.trim();
  // Sanitize: strip path separators and limit length; fall back to original filename
  const displayName = rawCustomName
    ? rawCustomName.replace(/[\\/]/g, "").slice(0, 200) || file.name
    : file.name;

  let headers: string[] = [];
  let dataLines: string[][] = [];

  if (isXLSX) {
    // Parse Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });
    
    if (jsonData.length < 2) {
      return NextResponse.json({ error: "Excel file has no data rows" }, { status: 400 });
    }
    
    headers = (jsonData[0] as string[]).map(h => String(h).trim());
    dataLines = jsonData.slice(1).filter((row: string[]) => row.some(cell => String(cell).trim()));
  } else {
    // Parse CSV file
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
    }
    headers = parseCsvLine(lines[0]);
    dataLines = lines.slice(1).map(line => parseCsvLine(line));
  }

  if (dataLines.length === 0) {
    return NextResponse.json({ error: "File has no data rows" }, { status: 400 });
  }

  // Create CsvFile record
  const csvFile = await prisma.csvFile.create({
    data: {
      originalName: displayName,
      uploadedBy: session.user!.id!,
      rowCount: 0,
    },
  });

  // Prepare leads in chunks
  const CHUNK = 500;
  let count = 0;

  for (let i = 0; i < dataLines.length; i += CHUNK) {
    const chunk = dataLines.slice(i, i + CHUNK);
    const records = chunk.map((values) => {
      const known: Record<string, unknown> = { fileId: csvFile.id };
      const extra: Record<string, string> = {};

      headers.forEach((header, idx) => {
        const val = String(values[idx] ?? "").trim();
        const key = header.trim().toLowerCase().replace(/\s+/g, "_");
        if (KNOWN_FIELDS.has(key)) {
          if (key === "rating") {
            known[key] = val ? parseFloat(val) || null : null;
          } else if (key === "review_count") {
            known[key] = val ? parseInt(val) || null : null;
          } else {
            known[key] = val || null;
          }
        } else if (key) {
          extra[key] = val;
        }
      });

      if (Object.keys(extra).length > 0) {
        known.extraFields = extra;
      }

      return known;
    });

    await prisma.lead.createMany({ data: records as Prisma.LeadCreateManyInput[] });
    count += records.length;
  }

  // Update row count
  await prisma.csvFile.update({
    where: { id: csvFile.id },
    data: { rowCount: count },
  });

  return NextResponse.json({ id: csvFile.id, rowCount: count, name: displayName });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
