import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createServer, type RequestListener } from "node:http";
import { detectDocumentPii } from "@/lib/privacy/piiDetection.server";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";

const entities = [
  "PERSON",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "LOCATION",
  "IBAN_CODE",
  "CREDIT_CARD",
];
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...headers },
  });
const finding = { start: 2, end: 5, entity_type: "PERSON", score: 0.01 };
const fetchMock = vi.fn<typeof fetch>();
const nativeFetch = globalThis.fetch;

async function withTransportFixture(handler: RequestListener, run: () => Promise<void>) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("TEST_BINDING_REQUIRED");
    fetchMock.mockImplementation((url, options) => {
      const source = new URL(String(url));
      expect(source.origin).toBe("http://presidio-analyzer:3000");
      return nativeFetch(
        `http://127.0.0.1:${address.port}${source.pathname}${source.search}`,
        options,
      );
    });
    await run();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubEnv("PRESIDIO_ANALYZER_URL", "http://presidio-analyzer:3000");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("one bounded standard local Presidio capability, without privacy authority", () => {
  it("checks actual language coverage before sending original text and never follows redirects", async () => {
    fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(json([finding]));
    const result = await detectDocumentPii("😀 A😀B end", "de");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [coverageUrl, coverageRequest] = fetchMock.mock.calls[0];
    const [analyzeUrl, analyzeRequest] = fetchMock.mock.calls[1];
    expect(coverageUrl).toBe("http://presidio-analyzer:3000/supportedentities?language=de");
    expect(coverageRequest).not.toHaveProperty("body");
    expect(coverageRequest?.redirect).toBe("error");
    expect(analyzeUrl).toBe("http://presidio-analyzer:3000/analyze");
    expect(analyzeRequest?.method).toBe("POST");
    expect(analyzeRequest?.redirect).toBe("error");
    expect(analyzeRequest?.signal).toBe(coverageRequest?.signal);
    const request: unknown = JSON.parse(String(analyzeRequest?.body));
    expect(request).toMatchObject({
      text: "😀 A😀B end",
      language: "de",
      score_threshold: 0,
      return_decision_process: false,
      allow_list: [],
    });
    expect(result.findings).toEqual([{ start: 2, end: 5, label: "PERSON", score: 0.01 }]);
    expect(pseudonymizeDocumentText("😀 A😀B end", result.findings).pseudonymizedText).toMatch(
      /^😀 \[PERSON_[a-f0-9]{24}_1\] end$/,
    );
    expect(result).not.toHaveProperty("eligible");
    expect(result).not.toHaveProperty("text");
  });

  it.each(["en", "de"] as const)(
    "uses fixed functional per-request German patterns with explicit %s language, not declarative labels",
    async (language) => {
      fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(json([]));
      const result = await detectDocumentPii("unverified", language);
      const request: unknown = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
      expect(request).toMatchObject({
        ad_hoc_recognizers: [
          { supported_entity: "DE_TAX_ID", supported_language: language },
          { supported_entity: "DE_TAX_NUMBER", supported_language: language },
          { supported_entity: "DE_ID_CARD", supported_language: language },
          { supported_entity: "DE_PASSPORT", supported_language: language },
          { supported_entity: "EMAIL_ADDRESS", supported_language: language },
        ],
      });
      expect(result.requestedEntities).toHaveLength(10);
      expect(result.findings).toEqual([]);
      expect(result).not.toHaveProperty("coverageComplete");
      const manifest = z
        .object({
          ad_hoc_recognizers: z.array(
            z.object({
              patterns: z.array(z.object({ regex: z.string() })),
            }),
          ),
        })
        .parse(request);
      const examples = [
        "12345678901",
        "12/345/67890",
        "C7D8F9G0H",
        "C7D8F9G0H",
        "fixture-original@example.invalid",
      ];
      manifest.ad_hoc_recognizers.forEach((recognizer, index) => {
        expect(new RegExp(recognizer.patterns[0].regex).test(examples[index])).toBe(true);
      });
    },
  );

  it.each([
    "fixture@example.invalid",
    "fixture@internal",
    "fixture+tag@sub.example.invalid",
    "fixture@xn--bcher-kva.invalid",
    "müller@bücher.invalid",
  ])(
    "requests conservative structural email coverage without a public-TLD allowlist %s",
    async (email) => {
      fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(json([]));
      await detectDocumentPii(email, "en");
      const request = z
        .object({
          ad_hoc_recognizers: z.array(
            z.object({
              name: z.string(),
              patterns: z.array(z.object({ regex: z.string() })),
            }),
          ),
        })
        .parse(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)));
      const recognizer = request.ad_hoc_recognizers.find(
        (item) => item.name === "DocumentStructuralEmailRecognizer",
      );
      if (!recognizer) throw new Error("Expected structural email recognizer");
      expect(new RegExp(recognizer.patterns[0].regex).exec(email)?.[0]).toBe(email);
    },
  );

  it.each([
    undefined,
    "",
    "http://127.0.0.1:5002",
    "https://public.example/analyze",
    "http://presidio-analyzer:3000@public.example",
    "http://presidio-analyzer:3000/analyze",
    "http://presidio-analyzer:3000?key=secret",
    " http://presidio-analyzer:3000",
    "http://PRESIDIO-ANALYZER:3000",
  ])("does not send text to a default/fallback/invalid destination %s", async (endpoint) => {
    vi.stubEnv("PRESIDIO_ANALYZER_URL", endpoint);
    await expect(detectDocumentPii("original", "en")).rejects.toThrow("ENDPOINT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts only the same exact configured internal endpoint with an optional root slash", async () => {
    vi.stubEnv("PRESIDIO_ANALYZER_URL", "http://presidio-analyzer:3000/");
    fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(json([]));
    await detectDocumentPii("original", "en");
    expect(fetchMock.mock.calls[1][0]).toBe("http://presidio-analyzer:3000/analyze");
  });

  it.each(["", "a".repeat(1_000_001), "\ud800", "\udfff"])(
    "rejects empty/oversized/invalid Unicode input before any transport",
    async (text) => {
      await expect(detectDocumentPii(text, "en")).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not silently select a default language", async () => {
    await expect(
      Reflect.apply(detectDocumentPii, undefined, ["original", undefined]),
    ).rejects.toThrow("LANGUAGE_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[], entities.filter((entity) => entity !== "PERSON"), {}, [null]])(
    "refuses insufficient/malformed coverage before transmitting text",
    async (coverage) => {
      fetchMock.mockResolvedValueOnce(json(coverage));
      await expect(detectDocumentPii("original", "de")).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    {},
    null,
    [finding, null],
    [finding, { ...finding, end: 99 }],
    [{ ...finding, start: 3, end: 2 }],
    [{ ...finding, start: -1 }],
    [{ ...finding, start: 0.5 }],
    [{ ...finding, score: 1.1 }],
    [{ ...finding, entity_type: "" }],
    [{ ...finding, entity_type: "PERSON\n" }],
    Array.from({ length: 10_001 }, () => finding),
  ])(
    "rejects every malformed or partial result, never filtering a bad finding",
    async (payload) => {
      fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(json(payload));
      await expect(detectDocumentPii("😀 A😀B end", "en")).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("retains unknown and zero-score spans but drops potentially raw analyzer explanation/metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(json([...entities, "UNTRUSTED_METADATA"]))
      .mockResolvedValueOnce(
        json([
          {
            ...finding,
            entity_type: "NEW_PII_KIND",
            score: 0,
            analysis_explanation: { text: "untrusted raw analyzer details" },
            recognition_metadata: { value: "untrusted metadata" },
          },
        ]),
      );
    const result = await detectDocumentPii("😀 A😀B end", "en");
    expect(result.findings).toEqual([{ start: 2, end: 5, label: "PII", score: 0 }]);
    expect(result.reportedSupportedEntities).toEqual([...entities].sort());
    expect(JSON.stringify(result)).not.toContain("NEW_PII_KIND");
    expect(JSON.stringify(result)).not.toContain("untrusted");
    expect(pseudonymizeDocumentText("😀 A😀B end", result.findings).pseudonymizedText).toMatch(
      /^😀 \[PII_[a-f0-9]{24}_1\] end$/,
    );
  });

  it.each([400, 403, 404, 500])(
    "surfaces HTTP %s without retry, fallback or raw error",
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        new Response("original echoed by untrusted server", { status }),
      );
      await expect(detectDocumentPii("original", "en")).rejects.toThrow(
        "DOCUMENT_PII_HTTP_FAILURE",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    new Response("not-json", { headers: { "content-type": "application/json" } }),
    new Response("[]", { headers: { "content-type": "text/plain" } }),
    json(entities, { "content-length": String(4 * 1024 * 1024 + 1) }),
    json(entities, { "content-length": "-1" }),
    new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/json" } }),
  ])("fails closed on malformed transport framing/JSON/Unicode", async (response) => {
    fetchMock.mockResolvedValueOnce(response);
    await expect(detectDocumentPii("original", "en")).rejects.toThrow("DOCUMENT_PII_");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds actual streamed bytes even when content-length is absent", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(4 * 1024 * 1024));
            controller.enqueue(new Uint8Array(1));
          },
          cancel,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    await expect(detectDocumentPii("original", "en")).rejects.toThrow("RESPONSE_LIMIT");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 500, headers: { "content-type": "application/json" } },
    { status: 200, headers: { "content-type": "text/plain" } },
    { status: 200, headers: { "content-type": "application/json", "content-length": "9999999" } },
  ])("cancels rejected responses without consuming or retaining error bodies", async (framing) => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(new ReadableStream<Uint8Array>({ cancel }), framing),
    );
    await expect(detectDocumentPii("original", "en")).rejects.toThrow("DOCUMENT_PII_");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("decodes valid multibyte JSON split across transport chunks", async () => {
    fetchMock.mockResolvedValueOnce(json(entities)).mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const bytes = new TextEncoder().encode(JSON.stringify([{ ...finding, note: "😀" }]));
            const split = bytes.indexOf(0xf0) + 1;
            controller.enqueue(bytes.slice(0, split));
            controller.enqueue(bytes.slice(split));
            controller.close();
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    expect((await detectDocumentPii("😀 A😀B end", "en")).findings).toHaveLength(1);
  });

  it("surfaces one total deadline and sanitized transport failures without leaking originals or causes", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw new Error("original echoed by failed transport");
    });
    await expect(detectDocumentPii("original", "en")).rejects.toMatchObject({
      name: "DocumentPiiDetectionError",
      message: "DOCUMENT_PII_DEADLINE_EXCEEDED",
    });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(8_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["coverage", "findings"])(
    "does not return success or send another request when %s validation has exhausted the total deadline",
    async (stage) => {
      let clock = 0;
      vi.spyOn(performance, "now").mockImplementation(() => clock);
      fetchMock
        .mockImplementationOnce(async () => {
          if (stage === "coverage") clock = 8_000;
          return json(entities);
        })
        .mockImplementationOnce(async () => {
          clock = 8_000;
          return json([]);
        });
      await expect(detectDocumentPii("original", "en")).rejects.toThrow("DEADLINE_EXCEEDED");
      expect(fetchMock).toHaveBeenCalledTimes(stage === "coverage" ? 1 : 2);
    },
  );

  it("bounds a transport that ignores its abort signal instead of awaiting it forever", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const operation = detectDocumentPii("original", "en");
    controller.abort();
    await expect(operation).rejects.toThrow("DEADLINE_EXCEEDED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds stalled body reads and cancellation, without an unhandled rejection or success fallback", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    let notifyRead: () => void = () => {};
    const reading = new Promise<void>((resolve) => {
      notifyRead = resolve;
    });
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>(
      {
        pull: () => notifyRead(),
        cancel,
      },
      { highWaterMark: 0 },
    );
    fetchMock
      .mockResolvedValueOnce(json(entities))
      .mockResolvedValueOnce(
        new Response(body, { headers: { "content-type": "application/json" } }),
      );
    const operation = detectDocumentPii("original", "en");
    await reading;
    controller.abort();
    await expect(operation).rejects.toThrow("DEADLINE_EXCEEDED");
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not log originals, server responses or underlying transport errors", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    fetchMock.mockRejectedValueOnce(new Error("original echoed by failed transport"));
    let failure: unknown;
    try {
      await detectDocumentPii("original", "en");
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ message: "DOCUMENT_PII_TRANSPORT_FAILURE" });
    expect(failure).not.toHaveProperty("cause");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("projects and transforms an actual HTTP API fixture without confusing it with a real analyzer/model proof", async () => {
    const calls: string[] = [];
    await withTransportFixture(
      (request, response) => {
        calls.push(`${request.method} ${request.url}`);
        response.setHeader("content-type", "application/json");
        if (request.method === "GET") response.end(JSON.stringify(entities));
        else response.end(JSON.stringify([finding]));
      },
      async () => {
        const result = await detectDocumentPii("😀 A😀B end", "de");
        expect(result.findings).toHaveLength(1);
        expect(pseudonymizeDocumentText("😀 A😀B end", result.findings).pseudonymizedText).toMatch(
          /^😀 \[PERSON_[a-f0-9]{24}_1\] end$/,
        );
        expect(calls).toEqual(["GET /supportedentities?language=de", "POST /analyze"]);
      },
    );
  });

  it("rejects an actual HTTP redirect without following it or transmitting text", async () => {
    const paths: (string | undefined)[] = [];
    await withTransportFixture(
      (request, response) => {
        paths.push(request.url);
        response.writeHead(302, { location: "/redirect-target" });
        response.end();
      },
      async () => {
        await expect(detectDocumentPii("original", "en")).rejects.toThrow("TRANSPORT_FAILURE");
        expect(paths).toEqual(["/supportedentities?language=en"]);
      },
    );
  });

  it("aborts an actual stalled response body at the single eight-second total deadline", async () => {
    const started = performance.now();
    await withTransportFixture(
      (request, response) => {
        response.setHeader("content-type", "application/json");
        if (request.method === "GET") response.end(JSON.stringify(entities));
        else response.write("[");
      },
      async () => {
        await expect(detectDocumentPii("original", "en")).rejects.toThrow("DEADLINE_EXCEEDED");
        expect(performance.now() - started).toBeGreaterThanOrEqual(7_500);
        expect(performance.now() - started).toBeLessThan(12_000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );
  }, 15_000);
});
