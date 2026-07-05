import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XeroLoginButton } from "@/components/auth/xero-login-button";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

type AuthCardProps = {
  defaultMode?: AuthMode;
  className?: string;
  compact?: boolean;
};

export function AuthCard({ defaultMode = "signin", className, compact = false }: AuthCardProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.href = "/app";
  }

  return (
    <div className={cn("panel p-8", className)}>
      {!compact && (
        <div className="mb-6 flex rounded-lg bg-surface-2 p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>
      )}

      <XeroLoginButton
        label={mode === "signup" ? "Sign up with Xero" : "Login with Xero"}
        className="w-full"
        variant="default"
      />

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" size="lg">
          {mode === "signup" ? "Create account" : "Sign in with email"}
        </Button>
      </form>

      {!compact && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By connecting Xero you authorise UpFlow to read your invoices and contacts.
        </p>
      )}
    </div>
  );
}
