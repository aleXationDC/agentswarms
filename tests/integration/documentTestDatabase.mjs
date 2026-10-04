import { spawn } from "node:child_process";

const container = process.env.AXTN_DOCUMENT_TEST_CONTAINER;
const database = process.env.AXTN_DOCUMENT_TEST_DATABASE;
if (!container || !database || !/^dms_native_contract_[a-z0-9_]+$/.test(database)) {
  throw new Error("An explicitly isolated dms_native_contract_* test database is required.");
}

export function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      database,
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ]);
    let output = "";
    let error = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      error += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(`Isolated psql failed: ${error}`)),
    );
    child.stdin.end(sql);
  });
}
