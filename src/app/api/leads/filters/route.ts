import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fileId = searchParams.get("fileId") || "";

  const where = fileId ? { fileId } : {};

  const [niches, locations, claimedVals, enrichmentVals] = await Promise.all([
    prisma.lead.findMany({ where, select: { search_niche: true }, distinct: ["search_niche"] }),
    prisma.lead.findMany({ where, select: { search_location: true }, distinct: ["search_location"] }),
    prisma.lead.findMany({ where, select: { claimed: true }, distinct: ["claimed"] }),
    prisma.lead.findMany({ where, select: { enrichment_status: true }, distinct: ["enrichment_status"] }),
  ]);

  return NextResponse.json({
    niches: niches.map((r) => r.search_niche).filter(Boolean),
    locations: locations.map((r) => r.search_location).filter(Boolean),
    claimed: claimedVals.map((r) => r.claimed).filter(Boolean),
    enrichmentStatus: enrichmentVals.map((r) => r.enrichment_status).filter(Boolean),
  });
}
