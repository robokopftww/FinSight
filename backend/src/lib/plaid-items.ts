type PlaidItemClient = {
  plaidItem: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<{ id: string; accessToken: string } | null>;
    delete(args: { where: { id: string } }): Promise<{ id: string }>;
  };
};

export async function deleteOwnedPlaidItem(
  prisma: PlaidItemClient,
  userId: string,
  itemId: string,
  removeFromPlaid: (accessToken: string) => Promise<unknown>,
) {
  const item = await prisma.plaidItem.findFirst({
    where: { id: itemId, userId },
  });

  if (!item) {
    return null;
  }

  await removeFromPlaid(item.accessToken);

  return prisma.plaidItem.delete({
    where: { id: item.id },
  });
}
