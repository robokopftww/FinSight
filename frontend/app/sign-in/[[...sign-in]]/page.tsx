import { SignIn } from "@clerk/nextjs";

import { AuthOverlayShell } from "@/components/auth-overlay-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkLocalization } from "@/lib/clerk-localization";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignInPage() {
  if (!isClerkConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-slate-950">
        <div className="max-w-md rounded-[28px] border border-slate-200 bg-slate-50 p-8 text-center">
          <h1 className="text-2xl font-semibold">Clerk is not configured yet</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Add your Clerk keys to `frontend/.env.local` to enable sign-in and account creation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AuthOverlayShell label="sign in">
      <SignIn
        appearance={clerkAppearance}
        localization={clerkLocalization}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
      />
    </AuthOverlayShell>
  );
}
