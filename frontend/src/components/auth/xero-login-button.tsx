import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchHealth, fetchXeroAuthUrl } from "@/lib/kinetic/api";
import { cn } from "@/lib/utils";

type XeroLoginButtonProps = {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function XeroLoginButton({
  label = "Login with Xero",
  className,
  size = "lg",
  variant = "outline",
}: XeroLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const status = await fetchHealth();
      if (!status.xeroConfigured) {
        toast.error("Xero is not configured on the backend", {
          description:
            "Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env, then restart the backend.",
        });
        return;
      }
      const authUrl = await fetchXeroAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Xero login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
      onClick={handleClick}
      disabled={loading}
    >
      <img src="https://www.xero.com/favicon.ico" className="size-4" alt="" />
      {loading ? "Redirecting…" : label}
    </Button>
  );
}
