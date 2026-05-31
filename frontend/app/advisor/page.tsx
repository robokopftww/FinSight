import { AdvisorChat } from "@/components/advisor-chat";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/panel";

export default function AdvisorPage() {
  return (
    <AppShell currentPath="/advisor" eyebrow="AI advisor" title="Ask FinSight what your money can handle">
      <Panel className="p-6">
        <AdvisorChat />
      </Panel>
    </AppShell>
  );
}
