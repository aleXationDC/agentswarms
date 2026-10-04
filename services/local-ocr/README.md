# Local deterministic PDF OCR

Recovered from the historical DMS service at
`7123d0ef167e72b39ee39a944e418003a253f50f`, with bounded fail-closed repairs.
This is local byte extraction, not semantic processing or a privacy grant.
It does not assert provider rights, source revision, filing, approval or Case
closure. It is not deployed or connected to the live n8n network.

`POST /ocr` accepts `application/pdf`, one exact Content-Length, and the existing
transport headers `X-aXtn-Source-Id`, `X-aXtn-Source-Name` and
`X-aXtn-Original-SHA256`. The hash must equal SHA-256 computed from the received
original bytes. ID/name remain transport-supplied locators, not server-verified
provider authority; the existing n8n normalization fields are retained.

The success envelope contains `schema_version: local-ocr-result-v1`, `text`,
`extraction_method: local_ocr`, computed `original_sha256`, complete `page_count`
and the existing `source_id`, `source_name`, `source_mime` transport fields.
The text is transient local output, not provider-safe content. An actual
protected local privacy/source adapter is still required before any semantic
processing; the response cannot set `verified_privacy_status`.

Originals are bounded to 20 MiB and 20 pages. Page count is read before rendering;
long PDFs fail instead of silently extracting only their first twenty pages.
Every page must render and yield text, ordered numerically. Two simultaneous
requests maximum share a 120-second whole-extraction deadline, not a renewed
deadline per page. English and German Tesseract models are installed explicitly.
Malformed framing, mismatched hashes, empty/incomplete extraction and tool errors
are failures, never empty-success fallbacks. Errors expose no document/process
output. Temporary originals/pages are scoped to the request and removed.

For any future native Host composition, keep the service non-root, read-only,
without persistent mounts or public ports; require an internal no-egress network,
ALL capabilities dropped, no-new-privileges, 128 PIDs, at most 1 GiB memory/
2 CPUs, and a 256 MiB temporary filesystem. Preserve existing n8n connections;
do not attach this raw-content service to the shared API or public network.
An exact tested immutable image/source pin is required before activation.

The normal Vitest suite invokes the isolated Python contract tests:

```sh
npx vitest run tests/unit/documentLocalOcr.test.ts
```

Actual tool/HTTP/restart verification uses one uniquely named disposable test
container with network `none`, no host ports/mounts and the stated resource
limits. It refuses an existing container of that name and cleans only the one
it creates. It uses self-generated synthetic PDFs, not production documents.

```sh
docker build --tag axtn-dms-local-ocr:recovery-test services/local-ocr
python3 services/local-ocr/test_container.py
```

This bounded OCR proof is not a full DMS/source/privacy/NO_AI acceptance result.
No Presidio, runtime activation or n8n execution-key expansion is implicit.
