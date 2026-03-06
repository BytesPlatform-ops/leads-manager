import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { subDays, format } from "date-fns";
import { Prisma } from "@prisma/client";

const VALID_PERIODS = ["7d", "14d", "30d", "90d", "all"] as const;
type Period = (typeof VALID_PERIODS)[number];

function getPeriodDays(period: Period): number | null {
  switch (period) {
    case "7d": return 7;
    case "14d": return 14;
    case "30d": return 30;
    case "90d": return 90;
    case "all": return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const period = (VALID_PERIODS.includes(params.get("period") as Period)
    ? params.get("period")
    : "30d") as Period;
  const fileId = params.get("fileId") || undefined;
  const niche = params.get("niche") || undefined;
  const location = params.get("location") || undefined;
  const userId = params.get("userId") || undefined;

  const now = new Date();
  const days = getPeriodDays(period);
  const periodStart = days ? subDays(now, days) : new Date("2000-01-01");
  const activityDays = Math.min(days ?? 30, 30);
  const activityStart = subDays(now, activityDays);
  const prevPeriodStart = days ? subDays(periodStart, days) : null;

  // Build lead WHERE clause for Prisma queries
  const leadWhere: Prisma.LeadWhereInput = {};
  if (fileId) leadWhere.fileId = fileId;
  if (niche) leadWhere.search_niche = niche;
  if (location) leadWhere.city_state = location;

  // Build disposition WHERE clause
  const dispWhere: Prisma.LeadDispositionWhereInput = {
    createdAt: { gte: periodStart },
  };
  if (userId) dispWhere.userId = userId;
  if (fileId || niche || location) {
    dispWhere.lead = leadWhere;
  }

  const noteWhere: Prisma.LeadNoteWhereInput = {
    createdAt: { gte: periodStart },
  };
  if (userId) noteWhere.userId = userId;
  if (fileId || niche || location) {
    noteWhere.lead = leadWhere;
  }

  // SQL filter params (use empty string for NULL to satisfy parameterized queries)
  const sqlFileId = fileId ?? "";
  const sqlNiche = niche ?? "";
  const sqlLocation = location ?? "";
  const sqlUserId = userId ?? "";

  // Run all queries in parallel
  const [
    totalLeads,
    totalFiles,
    totalUsers,
    totalNotes,
    leadsWithDispositions,
    dispositionBreakdown,
    nichesResult,
    locationsResult,
    ratingDistribution,
    recentActivity,
    userStats,
    dailyDispositions,
    enrichmentStats,
    topRatedLeads,
    conversionFunnel,
    filesWithStats,
    allFiles,
    allNiches,
    allLocations,
    allUsers,
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.csvFile.count(),
    prisma.user.count({ where: { role: "VIEWER" } }),
    prisma.leadNote.count({ where: noteWhere }),

    prisma.lead.count({
      where: { ...leadWhere, dispositions: { some: dispWhere } },
    }),

    prisma.leadDisposition.groupBy({
      by: ["status"],
      _count: { id: true },
      where: dispWhere,
      orderBy: { _count: { id: "desc" } },
    }),

    prisma.lead.groupBy({
      by: ["search_niche"],
      _count: { id: true },
      where: { ...leadWhere, search_niche: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    prisma.lead.groupBy({
      by: ["city_state"],
      _count: { id: true },
      where: { ...leadWhere, city_state: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    prisma.$queryRaw<{ rating_bucket: string; count: bigint }[]>`
      SELECT rating_bucket, count FROM (
        SELECT 
          CASE 
            WHEN rating IS NULL THEN 'No Rating'
            WHEN rating >= 4.5 THEN '4.5-5.0'
            WHEN rating >= 4.0 THEN '4.0-4.5'
            WHEN rating >= 3.5 THEN '3.5-4.0'
            WHEN rating >= 3.0 THEN '3.0-3.5'
            WHEN rating >= 2.0 THEN '2.0-3.0'
            ELSE 'Below 2.0'
          END as rating_bucket,
          COUNT(*) as count
        FROM "Lead"
        WHERE (${sqlFileId} = '' OR "fileId" = ${sqlFileId})
          AND (${sqlNiche} = '' OR search_niche = ${sqlNiche})
          AND (${sqlLocation} = '' OR city_state = ${sqlLocation})
        GROUP BY 1
      ) sub
      ORDER BY
        CASE rating_bucket
          WHEN '4.5-5.0' THEN 1
          WHEN '4.0-4.5' THEN 2
          WHEN '3.5-4.0' THEN 3
          WHEN '3.0-3.5' THEN 4
          WHEN '2.0-3.0' THEN 5
          WHEN 'Below 2.0' THEN 6
          ELSE 7
        END
    `,

    prisma.$queryRaw<{ activity_date: Date; notes: bigint; dispositions: bigint }[]>`
      WITH date_series AS (
        SELECT generate_series(
          ${activityStart}::date,
          ${now}::date,
          '1 day'::interval
        )::date as date
      ),
      daily_notes AS (
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "LeadNote" ln
        WHERE "createdAt" >= ${activityStart}
          AND (${sqlUserId} = '' OR "userId" = ${sqlUserId})
          AND (${sqlFileId} = '' OR EXISTS (
            SELECT 1 FROM "Lead" l WHERE l.id = ln."leadId" AND l."fileId" = ${sqlFileId}
          ))
        GROUP BY DATE("createdAt")
      ),
      daily_disps AS (
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "LeadDisposition" ld
        WHERE "createdAt" >= ${activityStart}
          AND (${sqlUserId} = '' OR "userId" = ${sqlUserId})
          AND (${sqlFileId} = '' OR EXISTS (
            SELECT 1 FROM "Lead" l WHERE l.id = ld."leadId" AND l."fileId" = ${sqlFileId}
          ))
        GROUP BY DATE("createdAt")
      )
      SELECT 
        ds.date as activity_date,
        COALESCE(dn.count, 0) as notes,
        COALESCE(dd.count, 0) as dispositions
      FROM date_series ds
      LEFT JOIN daily_notes dn ON ds.date = dn.date
      LEFT JOIN daily_disps dd ON ds.date = dd.date
      ORDER BY ds.date
    `,

    prisma.$queryRaw<{ user_id: string; email: string; role: string; notes_count: bigint; dispositions_count: bigint; conversions: bigint; interested: bigint; last_active: Date | null }[]>`
      SELECT 
        u.id as user_id,
        u.email,
        u.role::text,
        (SELECT COUNT(*) FROM "LeadNote" ln
         WHERE ln."userId" = u.id
           AND ln."createdAt" >= ${periodStart}
           AND (${sqlFileId} = '' OR EXISTS (SELECT 1 FROM "Lead" l WHERE l.id = ln."leadId" AND l."fileId" = ${sqlFileId}))
        ) as notes_count,
        (SELECT COUNT(*) FROM "LeadDisposition" ld
         WHERE ld."userId" = u.id
           AND ld."createdAt" >= ${periodStart}
           AND (${sqlFileId} = '' OR EXISTS (SELECT 1 FROM "Lead" l WHERE l.id = ld."leadId" AND l."fileId" = ${sqlFileId}))
        ) as dispositions_count,
        (SELECT COUNT(*) FROM "LeadDisposition" ld
         WHERE ld."userId" = u.id AND ld.status = 'CONVERTED'
           AND ld."createdAt" >= ${periodStart}
           AND (${sqlFileId} = '' OR EXISTS (SELECT 1 FROM "Lead" l WHERE l.id = ld."leadId" AND l."fileId" = ${sqlFileId}))
        ) as conversions,
        (SELECT COUNT(*) FROM "LeadDisposition" ld
         WHERE ld."userId" = u.id AND ld.status = 'INTERESTED'
           AND ld."createdAt" >= ${periodStart}
           AND (${sqlFileId} = '' OR EXISTS (SELECT 1 FROM "Lead" l WHERE l.id = ld."leadId" AND l."fileId" = ${sqlFileId}))
        ) as interested,
        GREATEST(
          (SELECT MAX("createdAt") FROM "LeadNote" WHERE "userId" = u.id),
          (SELECT MAX("createdAt") FROM "LeadDisposition" WHERE "userId" = u.id)
        ) as last_active
      FROM "User" u
      WHERE u.role = 'VIEWER'
      ORDER BY conversions DESC, dispositions_count DESC
    `,

    prisma.$queryRaw<{ disp_date: Date; status: string; count: bigint }[]>`
      SELECT 
        DATE("createdAt") as disp_date,
        status::text,
        COUNT(*) as count
      FROM "LeadDisposition" ld
      WHERE "createdAt" >= ${prevPeriodStart ?? periodStart}
        AND (${sqlUserId} = '' OR "userId" = ${sqlUserId})
        AND (${sqlFileId} = '' OR EXISTS (
          SELECT 1 FROM "Lead" l WHERE l.id = ld."leadId" AND l."fileId" = ${sqlFileId}
        ))
      GROUP BY DATE("createdAt"), status
      ORDER BY disp_date
    `,

    prisma.lead.groupBy({
      by: ["enrichment_status"],
      _count: { id: true },
      where: leadWhere,
    }),

    prisma.lead.findMany({
      where: {
        ...leadWhere,
        rating: { gte: 4.5 },
        review_count: { gte: 50 },
      },
      select: {
        id: true,
        business_name: true,
        rating: true,
        review_count: true,
        city_state: true,
        search_niche: true,
      },
      orderBy: [{ rating: "desc" }, { review_count: "desc" }],
      take: 10,
    }),

    prisma.$queryRaw<{ stage: string; count: bigint }[]>`
      SELECT 'Total Leads' as stage, COUNT(*)::bigint as count 
      FROM "Lead"
      WHERE (${sqlFileId} = '' OR "fileId" = ${sqlFileId})
        AND (${sqlNiche} = '' OR search_niche = ${sqlNiche})
        AND (${sqlLocation} = '' OR city_state = ${sqlLocation})
      UNION ALL
      SELECT 'Contacted' as stage, COUNT(DISTINCT ld."leadId")::bigint as count 
      FROM "LeadDisposition" ld
      JOIN "Lead" l ON l.id = ld."leadId"
      WHERE ld.status NOT IN ('NOT_CONTACTED')
        AND ld."createdAt" >= ${periodStart}
        AND (${sqlFileId} = '' OR l."fileId" = ${sqlFileId})
        AND (${sqlNiche} = '' OR l.search_niche = ${sqlNiche})
        AND (${sqlLocation} = '' OR l.city_state = ${sqlLocation})
        AND (${sqlUserId} = '' OR ld."userId" = ${sqlUserId})
      UNION ALL
      SELECT 'Interested' as stage, COUNT(DISTINCT ld."leadId")::bigint as count 
      FROM "LeadDisposition" ld
      JOIN "Lead" l ON l.id = ld."leadId"
      WHERE ld.status IN ('INTERESTED', 'CONVERTED')
        AND ld."createdAt" >= ${periodStart}
        AND (${sqlFileId} = '' OR l."fileId" = ${sqlFileId})
        AND (${sqlNiche} = '' OR l.search_niche = ${sqlNiche})
        AND (${sqlLocation} = '' OR l.city_state = ${sqlLocation})
        AND (${sqlUserId} = '' OR ld."userId" = ${sqlUserId})
      UNION ALL
      SELECT 'Converted' as stage, COUNT(DISTINCT ld."leadId")::bigint as count 
      FROM "LeadDisposition" ld
      JOIN "Lead" l ON l.id = ld."leadId"
      WHERE ld.status = 'CONVERTED'
        AND ld."createdAt" >= ${periodStart}
        AND (${sqlFileId} = '' OR l."fileId" = ${sqlFileId})
        AND (${sqlNiche} = '' OR l.search_niche = ${sqlNiche})
        AND (${sqlLocation} = '' OR l.city_state = ${sqlLocation})
        AND (${sqlUserId} = '' OR ld."userId" = ${sqlUserId})
    `,

    prisma.csvFile.findMany({
      select: {
        id: true,
        originalName: true,
        uploadedAt: true,
        rowCount: true,
        uploader: { select: { email: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { uploadedAt: "desc" },
      take: 20,
    }),

    // Filter dropdown options
    prisma.csvFile.findMany({
      select: { id: true, originalName: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.lead.groupBy({
      by: ["search_niche"],
      where: { search_niche: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 50,
    }),
    prisma.lead.groupBy({
      by: ["city_state"],
      where: { city_state: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 50,
    }),
    prisma.user.findMany({
      where: { role: "VIEWER" },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
    }),
  ]);

  // Process data
  const dispositionData = dispositionBreakdown.map((d) => ({
    status: d.status,
    count: d._count.id,
    label: formatDispositionLabel(d.status),
  }));

  const nicheData = nichesResult.map((n) => ({
    niche: n.search_niche ?? "Unknown",
    count: n._count.id,
  }));

  const locationData = locationsResult.map((l) => ({
    location: l.city_state ?? "Unknown",
    count: l._count.id,
  }));

  const ratingData = ratingDistribution.map((r) => ({
    bucket: r.rating_bucket,
    count: Number(r.count),
  }));

  const activityData = recentActivity.map((a) => ({
    date: format(new Date(a.activity_date), "MMM d"),
    notes: Number(a.notes),
    dispositions: Number(a.dispositions),
  }));

  const userPerformance = userStats.map((u) => ({
    userId: u.user_id,
    email: u.email,
    role: u.role,
    notes: Number(u.notes_count),
    dispositions: Number(u.dispositions_count),
    conversions: Number(u.conversions),
    interested: Number(u.interested),
    lastActive: u.last_active,
  }));

  const funnelData = [
    { stage: "Total Leads", count: 0 },
    { stage: "Contacted", count: 0 },
    { stage: "Interested", count: 0 },
    { stage: "Converted", count: 0 },
  ];
  conversionFunnel.forEach((f) => {
    const idx = funnelData.findIndex((d) => d.stage === f.stage);
    if (idx !== -1) funnelData[idx].count = Number(f.count);
  });

  const enrichmentData = enrichmentStats.map((e) => ({
    status: e.enrichment_status ?? "Not Enriched",
    count: e._count.id,
  }));

  const contactedLeads = leadsWithDispositions;
  const contactRate = totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(1) : "0";
  const conversionCount = funnelData.find((f) => f.stage === "Converted")?.count ?? 0;
  const conversionRate = contactedLeads > 0 ? ((conversionCount / contactedLeads) * 100).toFixed(1) : "0";

  const halfPeriod = days ? subDays(now, Math.floor(days / 2)) : subDays(now, 15);
  const thisHalfDisps = dailyDispositions
    .filter((d) => new Date(d.disp_date) >= halfPeriod)
    .reduce((sum, d) => sum + Number(d.count), 0);
  const lastHalfDisps = dailyDispositions
    .filter((d) => {
      const date = new Date(d.disp_date);
      return date >= periodStart && date < halfPeriod;
    })
    .reduce((sum, d) => sum + Number(d.count), 0);
  const weeklyChange = lastHalfDisps > 0
    ? (((thisHalfDisps - lastHalfDisps) / lastHalfDisps) * 100).toFixed(1)
    : "0";

  return NextResponse.json({
    overview: {
      totalLeads,
      totalFiles,
      totalUsers,
      totalNotes,
      contactedLeads,
      contactRate,
      conversionCount,
      conversionRate,
      thisWeekDispositions: thisHalfDisps,
      weeklyChange,
    },
    dispositions: dispositionData,
    niches: nicheData,
    locations: locationData,
    ratings: ratingData,
    activity: activityData,
    userPerformance,
    funnel: funnelData,
    enrichment: enrichmentData,
    topRatedLeads,
    recentFiles: filesWithStats.map((f) => ({
      id: f.id,
      name: f.originalName,
      uploadedAt: f.uploadedAt,
      rowCount: f.rowCount,
      uploadedBy: f.uploader.email,
      leadCount: f._count.leads,
    })),
    filters: {
      files: allFiles.map((f) => ({ id: f.id, name: f.originalName })),
      niches: allNiches.map((n) => n.search_niche).filter(Boolean) as string[],
      locations: allLocations.map((l) => l.city_state).filter(Boolean) as string[],
      users: allUsers.map((u) => ({ id: u.id, email: u.email, role: u.role })),
    },
  });
}

function formatDispositionLabel(status: string): string {
  const labels: Record<string, string> = {
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
  return labels[status] ?? status;
}
