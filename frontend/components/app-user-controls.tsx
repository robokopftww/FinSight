"use client";

import { UserButton } from "@clerk/nextjs";

export function AppUserControls() {
  return (
    <div className="flex items-center gap-3">
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
