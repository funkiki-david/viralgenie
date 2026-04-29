import { z } from "zod";

const RequestSchema = z.object({
  passcode: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }

  const expected = process.env.AUTH_PASSWORD;
  if (!expected) {
    return Response.json(
      { ok: false, error: "AUTH_PASSWORD not configured" },
      { status: 500 },
    );
  }

  if (parsed.data.passcode !== expected) {
    return Response.json({ ok: false }, { status: 401 });
  }

  return Response.json({ ok: true });
}
