const baseUrl = (process.env.SMOKE_BASE_URL || "https://yadraw.com").replace(/\/$/, "");

async function expectStatus(path, expected, init) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
  if (!expected.includes(response.status)) {
    throw new Error(`${path}: expected ${expected.join("/")}, received ${response.status}`);
  }
  process.stdout.write(`${path}: ${response.status}\n`);
}

await expectStatus("/login", [200]);
await expectStatus("/v2/dashboard", [302, 307]);
await expectStatus("/auth/signout", [403], {
  method: "POST",
  headers: { origin: "https://untrusted.example", "sec-fetch-site": "cross-site" }
});
