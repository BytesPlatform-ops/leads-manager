import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = await prisma.csvFile.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { uploader: { select: { email: true } } },
  });

  return NextResponse.json(files);
}
