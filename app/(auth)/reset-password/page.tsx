import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

/**
 * Reset-password page — the landing spot for the link in the reset email.
 *
 * Better Auth validates the token first (GET /api/auth/reset-password/:token)
 * and redirects here with either `?token=…` or `?error=INVALID_TOKEN`. Reading
 * the query server-side keeps the client tree out of a Suspense boundary,
 * which `useSearchParams` would otherwise require.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ll use this to sign in from now on
          </p>
        </div>

        {token && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <p
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
              role="alert"
            >
              This reset link is invalid or has expired. Reset links last an
              hour and can only be used once — request a fresh one.
            </p>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
