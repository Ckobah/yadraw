import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

config({ path: new URL("../../../.env", import.meta.url) });
config();

const databaseUrl = process.env.V2_DATABASE_URL;
if (!databaseUrl) throw new Error("V2_DATABASE_URL is required");

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations/v2"
);
const files = (await readdir(migrationsDir))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query("select pg_advisory_lock(hashtext('yadraw-v2-migrations'))");
  await client.query(`
    create table if not exists yadraw_schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  for (const filename of files) {
    const sql = await readFile(join(migrationsDir, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "select checksum from yadraw_schema_migrations where version = $1",
      [filename]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration checksum mismatch: ${filename}`);
      }
      continue;
    }

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into yadraw_schema_migrations (version, checksum) values ($1, $2)",
        [filename, checksum]
      );
      await client.query("commit");
      process.stdout.write(`Applied ${filename}\n`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(hashtext('yadraw-v2-migrations'))").catch(() => {});
  await client.end();
}
