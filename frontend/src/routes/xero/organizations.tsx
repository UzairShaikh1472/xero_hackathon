import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  fetchHealth,
  fetchXeroOrganizations,
  selectXeroOrganization,
  type XeroOrganization,
} from "@/lib/kinetic/api";

export const Route = createFileRoute("/xero/organizations")({
  component: XeroOrganizationsPage,
});

function XeroOrganizationsPage() {
  const [organizations, setOrganizations] = useState<XeroOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const health = await fetchHealth();
        if (health.xeroConnected) {
          window.location.href = "/app?xero=connected";
          return;
        }
        if (!health.pendingOrgSelection) {
          window.location.href = "/login";
          return;
        }

        const data = await fetchXeroOrganizations();
        if (data.organizations.length === 0) {
          setError("No Xero organizations found on your account.");
          return;
        }
        setOrganizations(data.organizations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load organizations");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function handleSelect(tenantId: string) {
    setSelectingId(tenantId);
    try {
      await selectXeroOrganization(tenantId);
      toast.success("Connected to Xero");
      window.location.href = "/app?xero=connected";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect organization");
      setSelectingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="px-6 py-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[480px]">
          <div className="mb-8 text-center">
            <span className="text-2xl font-semibold">UpFlow</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Choose your organisation</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Select the Xero organisation you want to connect. Your invoices and contacts will sync from this account.
            </p>
          </div>

          <div className="panel p-6">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-sm">Loading your Xero organisations…</span>
              </div>
            ) : error ? (
              <div className="space-y-4 py-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button asChild variant="outline">
                  <Link to="/login">Try again</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {organizations.map((org) => (
                  <li key={org.tenantId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 rounded-xl border hairline bg-surface px-4 py-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-2/60 disabled:opacity-60"
                      onClick={() => handleSelect(org.tenantId)}
                      disabled={selectingId !== null}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{org.tenantName}</div>
                        <div className="text-xs capitalize text-muted-foreground">
                          {org.tenantType.replace(/_/g, " ")}
                        </div>
                      </div>
                      {selectingId === org.tenantId ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-accent">Connect</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
