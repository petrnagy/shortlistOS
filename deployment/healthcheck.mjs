import { request } from "node:http";

const target = process.env.HEALTHCHECK_URL;

if (!target) {
  try {
    process.kill(1, 0);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

const check = request(target, { method: "GET", timeout: 5_000 }, (response) => {
  response.resume();
  process.exit(
    response.statusCode !== undefined && response.statusCode < 400 ? 0 : 1,
  );
});

check.on("timeout", () => check.destroy(new Error("Health check timed out")));
check.on("error", () => process.exit(1));
check.end();
