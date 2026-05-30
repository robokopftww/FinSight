"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

export function AuthControls({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <Button asChild>
        <Link href="/dashboard">Open app</Link>
      </Button>
    );
  }

  return <ClerkAuthControls />;
}

function ClerkAuthControls() {
  const { isSignedIn } = useUser();

  return (
    <div className="flex items-center gap-3">
      {isSignedIn ? (
        <>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <UserButton afterSignOutUrl="/" />
        </>
      ) : (
        <>
          <SignInButton mode="modal">
            <Button variant="ghost">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button>Create account</Button>
          </SignUpButton>
        </>
      )}
    </div>
  );
}
