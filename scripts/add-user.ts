/**
 * Add a user to the ViralGenie User table.
 *
 * Usage:
 *   npm run add-user -- --email=alice@example.com --password=Strong-Pass-1 --name=Alice --role=admin --locale=en
 *
 * Flags:
 *   --email     (required) login email; lowercased before storage
 *   --password  (required) plaintext password; bcrypt-hashed at rest
 *   --name      (optional) display name
 *   --role      (optional, default "user") "user" | "admin"
 *   --locale    (optional, default "en")   "en" | "zh"
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function fail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email?.toLowerCase().trim();
  const password = args.password;
  const name = args.name ?? null;
  const role = args.role ?? "user";
  const locale = args.locale ?? "en";

  if (!email) fail("--email is required");
  if (!password) fail("--password is required (min 8 chars recommended)");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`invalid email: ${email}`);
  if (role !== "user" && role !== "admin") fail(`role must be "user" or "admin"`);
  if (locale !== "en" && locale !== "zh") fail(`locale must be "en" or "zh"`);
  if (password.length < 8) {
    console.warn(`⚠ password is shorter than 8 chars — proceeding anyway`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL not set; check .env.local");

  const prisma = new PrismaClient({ adapter: new PrismaPg(url!) });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      fail(
        `user already exists: ${email} (id=${existing.id}, role=${existing.role}, locale=${existing.locale})`,
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, hashedPassword, name, role, locale },
      select: { id: true, email: true, name: true, role: true, locale: true, createdAt: true },
    });

    console.log("✓ user created");
    console.log(JSON.stringify(user, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✘ failed:", e);
  process.exit(1);
});
