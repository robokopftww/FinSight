import { AppShell } from "@/components/app-shell";
import { BankConnectionPanel } from "@/components/bank-connection-panel";
import { SettingsControlCenter } from "@/components/settings-control-center";

// Renders client components that use Clerk hooks; opt out of static prerender
// so the build does not require a ClerkProvider at export time.
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell currentPath="/settings" eyebrow="Control center" title="Manage connected data and AI runtime">
      <BankConnectionPanel />
      <SettingsControlCenter />
    </AppShell>
  );
}
