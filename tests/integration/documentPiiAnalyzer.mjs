import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { z } from "zod";
import { detectDocumentPii } from "@/lib/privacy/piiDetection.server";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";

const container = "axtn-dms-pii-contract-fixture";
const image = "sha256:d459416c39345b60b72050a98aeef6be4f6b3d9da20e5ba9561e8b920f9abedb";
const execute = promisify(execFile);
const inspection = await execute("docker", ["inspect", container], { maxBuffer: 1024 * 1024 });
z.array(
  z.object({
    Image: z.literal(image),
    State: z.object({ Running: z.literal(true) }),
    Config: z.object({
      User: z.literal("1001"),
      Labels: z.object({ "axtn.fixture.document-pii": z.literal("1") }),
    }),
    HostConfig: z.object({
      NetworkMode: z.literal("none"),
      ReadonlyRootfs: z.literal(true),
      Memory: z
        .number()
        .positive()
        .max(1536 * 1024 * 1024),
      PortBindings: z.object({}).strict(),
    }),
  }),
)
  .length(1)
  .parse(JSON.parse(inspection.stdout));

const probe = `import sys,json,urllib.request,urllib.error
request=json.load(sys.stdin)
assert request["path"] in ["/analyze","/supportedentities?language=en","/supportedentities?language=de"]
body=request.get("body")
data=None if body is None else body.encode("utf-8")
req=urllib.request.Request("http://127.0.0.1:3000"+request["path"],data=data,method=request["method"],headers={"content-type":"application/json"})
try:
    response=urllib.request.urlopen(req,timeout=7)
except urllib.error.HTTPError as error:
    response=error
raw=response.read(4194305)
assert len(raw)<=4194304
print(json.dumps({"status":response.status,"headers":dict(response.headers),"body":raw.decode("utf-8")}))
`;
const calls = [];
process.env.PRESIDIO_ANALYZER_URL = "http://presidio-analyzer:3000";
globalThis.fetch = async (url, options) => {
  const destination = new URL(String(url));
  assert.equal(destination.origin, "http://presidio-analyzer:3000");
  const path = destination.pathname + destination.search;
  calls.push(path);
  const output = await new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      ["exec", "-i", container, "python", "-c", probe],
      {
        signal: options?.signal ?? undefined,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) reject(new Error("ISOLATED_PROVIDER_TRANSPORT_FAILED"));
        else resolve(stdout);
      },
    );
    child.stdin?.end(
      JSON.stringify({
        path,
        method: options?.method,
        body: options?.body,
      }),
    );
  });
  const result = z
    .object({
      status: z.number().int(),
      headers: z.record(z.string(), z.string()),
      body: z.string(),
    })
    .parse(JSON.parse(output));
  return new Response(result.body, { status: result.status, headers: result.headers });
};

const marker = randomUUID();
const structuralEmails = [
  `fixture-${marker}@example.invalid`,
  `fixture-${marker}@internal`,
  `fixture+${marker}@sub.example.invalid`,
  `müller-${marker}@bücher.invalid`,
];
const text = `John Smith lives in New York.
${structuralEmails.map((email) => `Email: ${email}`).join("\n")}
Phone: +1 202-555-0100
IBAN: DE89370400440532013000
Credit card: 4111 1111 1111 1111
Steuer-ID: 12345678901
Steuernummer: 12/345/67890
Personalausweis: C7D8F9G0H
Reisepass: C7D8F9G0H`;

// The prior stock-only counterexample must now be covered by the native ad-hoc request.
const structural = await detectDocumentPii(text, "en");
const points = Array.from(text);
for (const email of structuralEmails) {
  assert(
    structural.findings.some(
      (finding) =>
        finding.label === "EMAIL_ADDRESS" &&
        points.slice(finding.start, finding.end).join("").includes(email),
    ),
    "STRUCTURAL_EMAIL_NOT_DETECTED",
  );
}
assert(
  !pseudonymizeDocumentText(text, structural.findings).pseudonymizedText.includes(marker),
  "STRUCTURAL_EMAIL_MARKER_RETAINED",
);
const positiveText = text.replace("@example.invalid", "@example.com");
const result = await detectDocumentPii(positiveText, "en");
assert.deepEqual(result.reportedSupportedEntities, [
  "CREDIT_CARD",
  "EMAIL_ADDRESS",
  "IBAN_CODE",
  "LOCATION",
  "PERSON",
  "PHONE_NUMBER",
]);
const found = new Set(result.findings.map((finding) => finding.label));
for (const entity of result.requestedEntities)
  assert(found.has(entity), `MISSING_REAL_FINDING_${entity}`);
const transformed = pseudonymizeDocumentText(positiveText, result.findings);
assert(!transformed.pseudonymizedText.includes(marker), "EMAIL_MARKER_RETAINED");
assert(!transformed.pseudonymizedText.includes("John Smith"), "PERSON_RETAINED");
assert(!transformed.pseudonymizedText.includes("12345678901"), "TAX_ID_RETAINED");
assert(!("eligible" in result));
assert.equal(calls.length, 4);
const previous = calls.length;
await assert.rejects(detectDocumentPii(text, "de"), /DOCUMENT_PII_/);
assert.equal(calls.length, previous + 1, "UNSUPPORTED_LANGUAGE_MUST_NOT_SEND_TEXT");
const logs = await execute("docker", ["logs", container], { maxBuffer: 2 * 1024 * 1024 });
assert(!(logs.stdout + logs.stderr).includes(marker), "RAW_MARKER_IN_ANALYZER_LOG");
console.log(
  JSON.stringify({
    status: "BOUNDED_CAPABILITY_PASS_NOT_PRIVACY_ELIGIBILITY",
    actualReportedBaseEntities: result.reportedSupportedEntities.length,
    actualRequestedLabelsDetected: [...found].sort(),
    zeroOriginalMarkerInLogs: true,
    unsupportedLanguageRejectedBeforeText: true,
    historicalStructuralEmailCounterexampleCorrected: true,
    structuralEmailVariantsRedacted: structuralEmails.length,
    eligibilityAuthority: false,
    image,
    network: "none",
  }),
);
