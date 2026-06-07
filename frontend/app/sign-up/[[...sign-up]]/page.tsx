import { SignUp } from "@clerk/nextjs";

import { AuthOverlayShell } from "@/components/auth-overlay-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkLocalization } from "@/lib/clerk-localization";

const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignUpPage() {
  if (!isClerkConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 text-white">
        <div className="max-w-md rounded-[28px] border border-white/8 bg-white/5 p-8 text-center">
          <h1 className="text-2xl font-semibold">Clerk is not configured yet</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Add your Clerk keys to `frontend/.env.local` to enable sign-up and account creation.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AuthOverlayShell label="sign up">
      <SignUp
        appearance={clerkAppearance}
        localization={clerkLocalization}
        fallbackRedirectUrl="/dashboard"
        signInUrl="/sign-in"
      />
    </AuthOverlayShell>
  );
}
