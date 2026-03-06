import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const KNOWN_FIELDS = [
  "business_name", "phone", "address", "city_state", "rating",
  "review_count", "website_domain", "claimed", "detail_path",
  "search_niche", "search_location", "scraped_at", "email",
  "website_full", "facebook", "twitter", "linkedin", "instagram",
  "enrichment_status", "enriched_at",
];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fileId = searchParams.get("fileId") || "";
  const search = searchParams.get("search") || "";
  const niche = searchParams.get("niche") || "";
  const location = searchParams.get("location") || "";
  const claimed = searchParams.get("claimed") || "";
  const enrichmentStatus = searchParams.get("enrichmentStatus") || "";
  const ratingMin = searchParams.get("ratingMin") ? parseFloat(searchParams.get("ratingMin")!) : undefined;
  const ratingMax = searchParams.get("ratingMax") ? parseFloat(searchParams.get("ratingMax")!) : undefined;
  const usageStatus = searchParams.get("usageStatus") || "";
  const sortBy = searchParams.get("sortBy") || "business_name";
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (fileId) {
    where.fileId = fileId;
  }

  if (search) {
    where.OR = [
      { business_name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { city_state: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { website_domain: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  if (niche) where.search_niche = { equals: niche, mode: "insensitive" };
  if (location) where.search_location = { equals: location, mode: "insensitive" };
  if (claimed) where.claimed = { equals: claimed, mode: "insensitive" };
  if (enrichmentStatus) where.enrichment_status = { equals: enrichmentStatus, mode: "insensitive" };
  if (ratingMin !== undefined || ratingMax !== undefined) {
    where.rating = {};
    if (ratingMin !== undefined) (where.rating as Record<string,number>).gte = ratingMin;
    if (ratingMax !== undefined) (where.rating as Record<string,number>).lte = ratingMax;
  }

  // Filter by usage status (used = has any disposition, unused = no dispositions)
  if (usageStatus === "used") {
    where.dispositions = { some: {} };
  } else if (usageStatus === "unused") {
    where.dispositions = { none: {} };
  }

  const allowedSortFields = KNOWN_FIELDS;
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : "business_name";

  const userId = session.user?.id;
  const isAdmin = session.user?.role === "ADMIN";

  try {
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
      where,
      orderBy: { [orderByField]: sortDir },
      skip,
      take: limit,
      select: {
        id: true,
        fileId: true,
        business_name: true,
        phone: true,
        address: true,
        city_state: true,
        rating: true,
        review_count: true,
        website_domain: true,
        claimed: true,
        detail_path: true,
        search_niche: true,
        search_location: true,
        scraped_at: true,
        email: true,
        website_full: true,
        facebook: true,
        twitter: true,
        linkedin: true,
        instagram: true,
        enrichment_status: true,
        enriched_at: true,
        extraFields: true,
        file: { select: { originalName: true } },
        _count: { select: { notes: true, dispositions: true } },
        dispositions: {
          // Admins see latest disposition from any user, viewers see only their own
          where: isAdmin ? {} : (userId ? { userId } : { userId: "" }),
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
      }),
      prisma.lead.count({ where }),
    ]);

    const mapped = leads.map((lead) => {
      const { _count, dispositions, ...rest } = lead;
      return {
        ...rest,
        _noteCount: _count.notes,
        _isUsed: _count.dispositions > 0,
        _myDisposition: dispositions.length > 0 ? dispositions[0].status : null,
      };
    });

    return NextResponse.json({
      leads: mapped,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[GET /api/leads] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
