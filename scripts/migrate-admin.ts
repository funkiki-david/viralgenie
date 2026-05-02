/**
 * One-shot migration: re-assign legacy AnalysisTask.createdBy values
 * (e.g., "anonymous", "ViralGenie User") to a real admin user's email.
 *
 * Usage:
 *   ADMIN_EMAIL=david@viralgenie.com npm run migrate-admin
 *
 * - The admin user must already exist in the User table (run `npm run add-user` first).
 * - Idempotent: safe to run multiple times. Tasks already attributed to the
 *   admin email are left alone.
 * - Reports counts before/after.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { config as loadEnv } from "dotenv";

// Don't override existing env — when invoked via `railway run`, Railway's
// injected DATABASE_URL must win over the local .env.local value.
loadEnv({ path: ".env.local", override: false });

// Legacy createdBy values that pre-date the User table.
const LEGACY_VALUES = ["anonymous", "ViralGenie User"];

function fail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail) {
    fail("ADMIN_EMAIL env var is required (e.g., ADMIN_EMAIL=david@x.com)");
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL not set; check .env.local");

  const prisma = new PrismaClient({ adapter: new PrismaPg(url!) });

  try {
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, email: true, role: true },
    });
    if (!admin) {
      fail(
        `admin user not found: ${adminEmail}. Run \`npm run add-user -- --email=${adminEmail} --password=... --role=admin\` first.`,
      );
    }

    console.log(`→ Migrating tasks to admin: ${admin.email} (${admin.id})`);

    // Snapshot before
    const before = await prisma.analysisTask.groupBy({
      by: ["createdBy"],
      _count: true,
      orderBy: { _count: { createdBy: "desc" } },
    });
    console.log("\nBefore:");
    for (const row of before) {
      console.log(`  ${String(row.createdBy).padEnd(24)} ${row._count}`);
    }

    // Update legacy values + any other non-email values that don't equal the admin
    // (we identify "needs migration" as: not containing '@')
    const result = await prisma.analysisTask.updateMany({
      where: {
        OR: [
          { createdBy: { in: LEGACY_VALUES } },
          // Anything that doesn't look like an email address from the new flow
          { NOT: { createdBy: { contains: "@" } } },
        ],
      },
      data: { createdBy: admin.email },
    });

    console.log(`\n✓ Updated ${result.count} task(s) → ${admin.email}`);

    // Snapshot after
    const after = await prisma.analysisTask.groupBy({
      by: ["createdBy"],
      _count: true,
      orderBy: { _count: { createdBy: "desc" } },
    });
    console.log("\nAfter:");
    for (const row of after) {
      console.log(`  ${String(row.createdBy).padEnd(24)} ${row._count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✘ migration failed:", e);
  process.exit(1);
});
