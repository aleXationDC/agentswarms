# Native scoped MCP consumer – source checkpoint

This work belongs to implementation Parent Case
`85a1d829-39ac-49bd-9047-163ab52d427b` and Gitea-MCP Boundary Child
`3fbd099a-13bd-4186-8462-6f92b1ebd4d5`.

The existing MCP broker now resolves the managed native credential on the
server, bound to the exact Host-configured registry ID, owner, name, endpoint
and authentication type. Registry loading and the existing UI probe use the
same resolver. Generic user-owned MCP authentication is preserved.
Neither the registry payload nor client build contains the protected native
access credential. This access credential is separate from the Gitea PAT.

Source validation on 2026-10-03:

- `npm run typecheck`: PASS.
- Native MCP focused suite: 8 tests PASS.
- `npm run lint`: PASS, no errors; existing warnings retained.
- Docs, Markdown docs, documented commands and infrastructure checks: PASS.
  PowerShell parsing was skipped because the tool is unavailable.
- Full unit suite: 551 files PASS; 8,997 tests PASS, 40 SKIP.
- `npm run build`: PASS.
- Native credential environment names/resolver absent from client assets: PASS.

The corresponding Gitea-MCP server candidate is
`298d79eab8d4dc8d1e8dceba2e807f62849c14f4`, with 37 passing policy and
native SDK tests, including real HTTP initialization authentication.
Its exact local image is
`sha256:ced79756b3248cc1473fcf105f6388301c52a96f95af348ad1c9d442475b3c67`.

**IMPLEMENTED / TESTED.** At this source checkpoint, the consumer and scoped
service are not yet deployed or runtime accepted. Host mutation/rollback and
integrated runtime results are recorded separately in Host evidence.

The remaining executable Swarm will default to the owner's already connected
OpenAI integration. No replacement provider credentials or Gemini default
are introduced by this checkpoint.
