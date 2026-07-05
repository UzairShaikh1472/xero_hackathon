import os from "node:os";
import path from "node:path";

export function getDataDir() {
  const root = process.env.VERCEL ? os.tmpdir() : process.cwd();
  return path.join(root, ".data");
}

export function getDataFilePath(filename: string) {
  return path.join(getDataDir(), filename);
}
