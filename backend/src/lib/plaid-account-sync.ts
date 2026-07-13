type PlaidItemReference = {
  id: string;
  userId: string;
  plaidItemId: string;
  accessToken: string;
  institutionName: string;
};

type PlaidAccountSnapshot = {
  account_id: string;
  name: string;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: {
    current?: number | null;
    available?: number | null;
    iso_currency_code?: string | null;
  };
};

type AccountWrite = {
  userId: string;
  itemId: string;
  plaidItemId: string;
  plaidAccountId: string;
  institutionName: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number | null;
  currencyCode: string;
  lastSyncedAt: Date;
};

type AccountSyncStore = {
  account: {
    upsert(args: {
      where: { plaidAccountId: string };
      create: AccountWrite;
      update: Omit<AccountWrite, "userId" | "plaidItemId" | "plaidAccountId">;
    }): Promise<unknown>;
  };
};

export type RefreshPlaidAccountsOptions = {
  store: AccountSyncStore;
  item: PlaidItemReference;
  fetchAccounts: (accessToken: string) => Promise<PlaidAccountSnapshot[]>;
  syncedAt: Date;
};

export async function refreshPlaidAccounts({
  store,
  item,
  fetchAccounts,
  syncedAt,
}: RefreshPlaidAccountsOptions) {
  const accounts = await fetchAccounts(item.accessToken);

  await Promise.all(
    accounts.map((account) => {
      const shared = {
        itemId: item.id,
        institutionName: item.institutionName,
        name: account.name,
        mask: account.mask ?? null,
        type: String(account.type),
        subtype: account.subtype ? String(account.subtype) : null,
        currentBalance: account.balances.current ?? 0,
        availableBalance: account.balances.available ?? null,
        currencyCode: account.balances.iso_currency_code ?? "USD",
        lastSyncedAt: syncedAt,
      };

      return store.account.upsert({
        where: { plaidAccountId: account.account_id },
        create: {
          userId: item.userId,
          plaidItemId: item.plaidItemId,
          plaidAccountId: account.account_id,
          ...shared,
        },
        update: shared,
      });
    }),
  );

  return accounts.length;
}
