import { AppShell } from "@/components/app-shell";
import { AdvisorChat } from "@/components/advisor-chat";

export const dynamic = "force-dynamic";

export default function AdvisorPage() {
  return (
    <AppShell
      currentPath="/advisor"
      eyebrow="Grounded conversation"
      title="Ask WealthLens anything about your money"
    >
      <AdvisorChat />
    </AppShell>
  );
}
