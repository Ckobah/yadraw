import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import pg from "pg";

const envPath = process.argv[2] ?? ".env";
const databaseUrl = process.env.V2_DATABASE_URL;
const replacement = process.env.NEW_DATABASE_PASSWORD;

if (!databaseUrl || !replacement || replacement.length < 32) {
  console.error("PostgreSQL credential rotation is not configured correctly");
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);
const previousPassword = decodeURIComponent(parsedUrl.password);
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

async function setCurrentPassword(connectionString, password) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query("select current_user");
    const role = result.rows[0]?.current_user;
    if (typeof role !== "string" || role.length === 0) throw new Error("Current role is unavailable");
    await client.query(`ALTER ROLE ${quoteIdentifier(role)} PASSWORD ${quoteLiteral(password)}`);
  } finally {
    await client.end();
  }
}

const temporaryPath = `${envPath}.tmp.${process.pid}`;
let passwordChanged = false;

try {
  await setCurrentPassword(databaseUrl, replacement);
  passwordChanged = true;

  parsedUrl.password = replacement;
  const envContents = await readFile(envPath, "utf8");
  const nextDatabaseUrl = parsedUrl.toString();
  const nextContents = /^V2_DATABASE_URL=.*$/m.test(envContents)
    ? envContents.replace(/^V2_DATABASE_URL=.*$/m, `V2_DATABASE_URL=${nextDatabaseUrl}`)
    : `${envContents.replace(/\s*$/, "")}\nV2_DATABASE_URL=${nextDatabaseUrl}\n`;

  await writeFile(temporaryPath, nextContents, { encoding: "utf8", mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, envPath);
  console.log("PostgreSQL credentials rotated successfully");
} catch {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  if (passwordChanged) {
    parsedUrl.password = replacement;
    await setCurrentPassword(parsedUrl.toString(), previousPassword).catch(() => undefined);
  }
  console.error("PostgreSQL credential rotation failed");
  process.exit(1);
}
