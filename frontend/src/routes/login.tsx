import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { UpFlowBrand } from "@/components/control-room/upflow-logo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to UpFlow
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <div className="flex justify-center">
              <UpFlowBrand size={32} textClassName="text-2xl" />
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Welcome</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in or create an account to access your cash control room
            </p>
          </div>

          <AuthCard />
        </div>
      </div>
    </div>
  );
}
