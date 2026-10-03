import { readOperatorUrls } from "./operatorBindings.server";

export function configuredOperators() {
  const result = readOperatorUrls();
  if (!result.ok) throw new Error(result.error);
  return [
    { label: "n8n", url: result.urls.n8n ?? null },
    { label: "Gitea", url: result.urls.gitea ?? null },
    { label: "Matrix", url: result.urls.matrix ?? null },
  ];
}
