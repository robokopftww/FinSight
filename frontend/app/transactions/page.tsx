import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { TransactionsWorkbench } from "@/components/transactions-workbench";
import { Panel } from "@/components/ui/panel";
import { getTransactions } from "@/lib/api";

export default async function TransactionsPage() {
  const { getToken } = await auth();
  const response = await getTransactions(await getToken());

  return (
    <AppShell currentPath="/transactions" eyebrow="Transaction intelligence" title="Search, filter, and recategorize your activity">
      <Panel className="p-6">
        <TransactionsWorkbench
          initialTransactions={response.data}
          categories={response.categories}
          summary={response.summary}
        />
      </Panel>
    </AppShell>
  );
}
