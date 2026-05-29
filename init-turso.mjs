import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not found in environment.");
    process.exit(1);
  }

  console.log("Connecting to Turso...");
  const client = createClient({ url, authToken });

  const sql = `
    CREATE TABLE IF NOT EXISTS "Job" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "repoUrl" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "message" TEXT,
        "prUrl" TEXT,
        "fixedCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await client.execute(sql);
    console.log("Job table created successfully.");
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main();
