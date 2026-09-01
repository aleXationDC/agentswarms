# aXtn Reviews

**Install:** No migration is required. The Workbench uses the native
`approvals` contract and its existing RLS.

**Use:** Search and filter native approval items, inspect their detail, use
only native approval decisions, and apply allowlisted Human Overrides to
editable proposal metadata. Bulk Edit changes only explicitly selected fields
on pending approvals with a proposal payload. Values common to all selected
items are shown as reference values; mixed values require an explicit
replacement. All writes use the caller's JWT and native approval RLS, and
successful writes reload canonical approval data. Mixed string and string-array
topic values are not bulk editable.

**Remove:** Remove the routes, `appNav` entries, and `src/axtn/workbenches/reviews/`.
