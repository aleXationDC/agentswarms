import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, ShieldAlert, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperadmin } from "@/hooks/use-iam";
import {
  axtnListSystemExtensions,
  type AxtnSystemExtension,
} from "@/utils/axtnSystemExtensions.functions";

export const Route = createFileRoute("/_authenticated/system-extensions")({
  head: () => ({
    meta: [{ title: "System Extensions — AgentSwarms" }],
  }),
  component: SystemExtensionsPage,
});

function SystemExtensionsPage() {
  const { user, session } = useAuth();
  const isSuperadmin = useIsSuperadmin();
  const [extensions, setExtensions] = useState<AxtnSystemExtension[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token || !isSuperadmin) return;
    axtnListSystemExtensions({ data: { access_token: session.access_token } })
      .then(setExtensions)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Could not load system extensions."),
      );
  }, [isSuperadmin, session?.access_token]);

  if (!user) return null;

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <Card className="mx-auto mt-12 max-w-lg border-destructive/40">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h1 className="mb-1 text-lg font-semibold">Restricted area</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              System extensions are only available to superadmins.
            </p>
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Go back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Wrench className="h-6 w-6 text-primary" /> System Extensions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Technical entry points managed for this instance.
        </p>
      </div>

      {error && (
        <Card className="max-w-3xl border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {extensions === null && !error && (
        <p className="text-sm text-muted-foreground">Loading system extensions...</p>
      )}

      {extensions?.length === 0 && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>No system extensions configured</CardTitle>
            <CardDescription>
              This fresh instance has no technical entry points configured yet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        {extensions?.map((extension) => (
          <Card key={extension.id}>
            <CardHeader>
              <CardTitle>{extension.label}</CardTitle>
              <CardDescription>{extension.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                href={extension.url}
                rel="noreferrer"
                target="_blank"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
