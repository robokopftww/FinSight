import { AdvisorChat } from "@/components/advisor-chat";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/panel";

// Renders client components that use Clerk hooks; opt out of static prerender
// so the build does not require a ClerkProvider at export time.
export const dynamic = "force-dynamic";

export default function AdvisorPage() {
  return (
    <AppShell currentPath="/advisor" eyebrow="AI advisor" title="Ask FinSight what your money can handle">
      <Panel className="p-6">
        <AdvisorChat />
      </Panel>
    </AppShell>
  );
}
