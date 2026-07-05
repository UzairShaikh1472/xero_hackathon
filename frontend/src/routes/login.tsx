import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bot, Phone, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.href = "/app";
  }

  async function handleXero() {
    setLoading(true);
    try {
      const res = await fetch("/api/xero/auth-url");
      const json = await res.json();
      if (json?.data?.authUrl) window.location.href = json.data.authUrl;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Back */}
      <div className="px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          Back to UpFlow
        </Link>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <span className="text-2xl font-semibold">UpFlow</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your cash control room
            </p>
          </div>

          <div className="panel p-8">
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
              <Button type="submit" className="w-full" size="lg">Sign in</Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              size="lg"
              onClick={handleXero}
              disabled={loading}
            >
              <img src="https://www.xero.com/favicon.ico" className="size-4" alt="" />
              {loading ? "Redirecting…" : "Connect with Xero"}
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
}
