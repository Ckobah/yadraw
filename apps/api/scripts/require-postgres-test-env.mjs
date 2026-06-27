import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url) });
config();

if (!process.env.DATABASE_URL_TEST) {
  console.error("DATABASE_URL_TEST is required for npm run test:postgres.");
  process.exit(1);
}
