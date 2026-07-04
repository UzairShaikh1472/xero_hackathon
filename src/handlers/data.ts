import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NormalizedData } from "../types/financial.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "../fixtures/demo-normalized.json");

let cached: NormalizedData | null = null;

/**
 * Load normalized financial data.
 * Uses the demo fixture until Person 1 ships live Xero data.
 */
export function getNormalizedData(): NormalizedData {
  if (!cached) {
    cached = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as NormalizedData;
  }
  return cached;
}

/** Test helper — clear cache if fixture is swapped. */
export function clearNormalizedDataCache(): void {
  cached = null;
}
