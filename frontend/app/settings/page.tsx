import { AppShell } from "@/components/app-shell";
import { SettingsControlCenter } from "@/components/settings-control-center";

export default function SettingsPage() {
  return (
    <AppShell currentPath="/settings" eyebrow="Control center" title="Manage connected data and AI runtime">
      <SettingsControlCenter />
    </AppShell>
  );
}
