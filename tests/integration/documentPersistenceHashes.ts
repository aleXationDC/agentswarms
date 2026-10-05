import assert from "node:assert/strict";
import { query } from "./documentTestDatabase.mjs";
import {
  documentOwnerScopeHash,
  documentScopedReferenceHash,
} from "@/axtn/workbenches/documents/documentPersistence.server";

const owner = "ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const quote = (value: string) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const values = [
  "fixture-reference",
  'fixture:"quoted"',
  "fixture:\\escaped\\path",
  "fixture:\u00e4\u03b1",
  "document-persistence-owner-v1",
];
for (const value of values) {
  const actual = await query(`SELECT encode(extensions.digest(
    convert_to('${owner}'::uuid::text,'UTF8')||decode('00','hex')||
    convert_to(${quote(value)}#>>'{}','UTF8'),'sha256'),'hex')`);
  assert.equal(actual, documentScopedReferenceHash(owner, value));
  assert.notEqual(actual, documentScopedReferenceHash(otherOwner, value));
}
assert.equal(
  documentOwnerScopeHash(owner),
  documentScopedReferenceHash(owner, "document-persistence-owner-v1"),
);
console.log(
  "PASS: actual isolated PostgreSQL SHA256 matches canonical-owner/NUL-framed native reference hashes across quotes, escapes and UTF8; foreign owner differs. Algorithm parity only, not provider/privacy/rights authority or full runtime persistence proof.",
);
