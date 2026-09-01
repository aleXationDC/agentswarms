# aXtn Documents

**Install:** No migration is required. Optionally provide the native,
user-owned `axtn_documents` dataset described by the manifest.

**Use:** Browse, search, inspect, and correct declared document metadata.
Single and Bulk Edit merge only allowlisted metadata fields and record human
override provenance; they do not rename, move, or modify source files.
A source link is shown only when the data contract provides one. AI analysis is
reserved for a future binding to the native AI Analyst/data contract.
Bulk corrections use the caller's JWT and native dataset RLS, show common or
mixed selected values, and reload canonical data after successful updates.
Mixed string and string-array topic values are not bulk editable.

**Remove:** Remove the routes, `appNav` entries, and
`src/axtn/workbenches/documents/`. No Workbench-owned data requires removal.
