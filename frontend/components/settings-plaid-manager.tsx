"use client";

import { useCallback, useState } from "react";

import { BankConnectionPanel } from "@/components/bank-connection-panel";
import { SettingsControlCenter } from "@/components/settings-control-center";

export function SettingsPlaidManager() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const notifyStatusChanged = useCallback(() => {
    setRefreshVersion((current) => current + 1);
  }, []);

  return (
    <>
      <BankConnectionPanel onStatusChanged={notifyStatusChanged} refreshVersion={refreshVersion} />
      <SettingsControlCenter onPlaidStatusChanged={notifyStatusChanged} refreshVersion={refreshVersion} />
    </>
  );
}
