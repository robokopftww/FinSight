"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export function UserSync() {
  const hasSynced = useRef(false);
  const { getToken, isSignedIn } = useAuth();
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!apiBaseUrl || !isLoaded || !isSignedIn || !user || hasSynced.current) {
      return;
    }

    hasSynced.current = true;

    async function syncUser() {
      const token = await getToken();

      await fetch(`${apiBaseUrl}/api/auth/sync-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clerkId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
        }),
      });
    }

    void syncUser();
  }, [getToken, isLoaded, isSignedIn, user]);

  return null;
}
