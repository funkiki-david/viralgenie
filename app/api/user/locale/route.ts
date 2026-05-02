import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";

const Body = z.object({
  locale: z.enum(["en", "zh"]),
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { locale: parsed.data.locale },
    select: { id: true, locale: true },
  });

  return Response.json({ ok: true, locale: updated.locale });
}
