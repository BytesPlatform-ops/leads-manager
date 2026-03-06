import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DispositionStatus } from "@prisma/client";

const VALID_STATUSES = new Set<string>(Object.values(DispositionStatus));

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const isAdmin = session.user.role === "ADMIN";

  const dispositions = await prisma.leadDisposition.findMany({
    where: isAdmin ? { leadId } : { leadId, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  const currentStatus = dispositions.length > 0
    ? dispositions[0].status
    : "NOT_CONTACTED";

  return NextResponse.json({ dispositions, currentStatus });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;

  let body: { status?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid disposition status" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const disposition = await prisma.leadDisposition.create({
    data: {
      leadId,
      userId: session.user.id,
      status: status as DispositionStatus,
      note: note || null,
    },
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  return NextResponse.json(disposition, { status: 201 });
}
