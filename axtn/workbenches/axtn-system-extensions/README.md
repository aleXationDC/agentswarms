# aXtn Extensions

**Install:** Apply the listed extension-access migrations, configure
`AXTN_SYSTEM_EXTENSIONS`, and install the matching Caddy configuration.

**Use:** A Superadmin with a current AAL2 session opens each configured target
with a separate, single-use ticket. The target retains its own sign-in.

**Remove:** Remove the route/navigation entry and the Caddy target blocks only
after revoking active sessions and removing the target configuration.
