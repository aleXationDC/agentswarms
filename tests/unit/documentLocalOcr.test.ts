import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recovered bounded native local OCR service", () => {
  it("executes Python extraction and HTTP contract tests without external tools or persistence", () => {
    const output = execFileSync("python3", ["-m", "unittest", "-v", "test_server"], {
      cwd: resolve("services/local-ocr"),
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(output).toBe("");
  });
});
