# aXtn Development Swarm – Repository Handoff

**Canonical repository:** `aXtn/aXtn-agentswarms`  
**Canonical branch:** `work/AXTN-DEVELOPMENT-SWARM-0001`  
**Branch base:** deployed AgentSwarms `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`  
**Tracking issue:** `aXtn/aXtn-agentswarms#7` – optional for the executor; the Git contract below is complete and does not require Issue API access.  
**Status:** `PREFLIGHT_PARTIAL_BLOCKED`

## Authority and access model

Gitea repository and runtime truth are authoritative. This repository-backed handoff is the complete execution contract for a server-side executor whose credential can use Git but intentionally lacks `read:issue`.

Do not request or widen the `axtn-codex` token solely to read Issue #7. Do not infer missing instructions from an inaccessible Issue. Read this file and both referenced contracts from the canonical branch.

## Mandatory reads

1. `docs/architecture/axtn-development-swarm/V1-IMPLEMENTATION-CONTRACT.md`
2. `docs/architecture/axtn-development-swarm/SUPACASE-CASE-MODEL.md`
3. applicable repository instructions
4. current Host execution/pin contracts named by the V1 contract

## Completed read-only findings to preserve

- Live AgentSwarms and Host pin agree on AgentSwarms `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`.
- Current Host task state reported at `5a437f454cf984238d554e26eadf43851c9624f2`.
- SupaCase source ancestry is present: deployed `844eddf5…` contains required base `86d10fe9…` as an ancestor.
- 63 focused SupaCase tests passed.
- Live smoke for Cases, Accounts and Contacts returned HTTP 200; the inspected owner-scoped data areas were empty.
- No source, configuration, product database, branch or runtime mutation was made by the read-only preflight.
- AgentSwarms cannot currently resolve/reach Gitea-MCP through Docker DNS/network.
- Live Gitea-MCP image reports source `dfbb45ad…`, while the Host manifest names `a85a333…`; provenance is inconsistent.
- Notebook Runtime is disabled, has no Grants or Sessions, and Squid reports absent generated ACL files.
- Existing staged changes in the current `aXtn-git` checkout are unrelated and must remain untouched. Use a separate clean worktree for any later authorized work.

## Authorized immediate continuation

The next action is documentation-only:

1. Fetch and check out this exact canonical branch in a separate clean worktree.
2. Read the mandatory contracts completely.
3. Complete the remaining read-only Phase-A analysis, including the SupaCase questions in `SUPACASE-CASE-MODEL.md` section 13.
4. Version the complete secret-free preflight report at:
   `handoffs/reports/AXTN-DEVELOPMENT-SWARM-PREFLIGHT-0001.md`
5. The report must contain exact commands/evidence references, full PASS/PARTIAL/BLOCKED matrix, root causes, affected repositories/files, proposed clean task branches, and the smallest safe ordered continuation.
6. Commit and push only that report and any strictly necessary correction to these architecture documents to this branch.

This continuation does **not** authorize source implementation, configuration mutation, product database mutation, runtime mutation, PROD change, merge, tag or release.

## Required analysis before implementation authorization

### Gitea-MCP

- reconcile actual runtime source/image with all Host manifest pins;
- determine the exact Docker network/DNS and AgentSwarms MCP-registry gap;
- prove the smallest repo-/tool-scoped internal binding;
- preserve direct-main and generic-merge denial;
- do not touch the unrelated dirty checkout.

### Notebook Runtime

- identify the exact enablement, IAM/Grant, image pin, resource-limit and egress contracts;
- explain why generated Squid ACL files are absent;
- distinguish disabled-by-policy from incomplete generation/configuration;
- propose a safe repair and acceptance sequence without enabling broad egress.

### SupaCase

- identify headless Case CRUD/relation access actually available to a Swarm;
- verify server-side Run-Owner binding without tokens in graph payloads;
- check for generic idempotent ensure-by-source behavior;
- assess directed Child-Case dependencies, work/result contracts and Human takeover;
- verify whether native audit supports the required measurement events and retention;
- identify minimal typed references for repository, issue, PR, run and evidence;
- preserve all DMS/Document/Resume behavior.

## Stop rules

Stop and report rather than workaround if:

- a required source/runtime fact cannot be verified;
- a repair would introduce a second control plane;
- a token or secret would enter Git, logs, prompts, traces or evidence;
- a protected/default branch or unrelated dirty worktree would be modified;
- implementation would begin before the documented stop gates receive an explicit continuation authorization.
