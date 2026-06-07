import { describe, expect, it, vi } from "vitest";

import { deleteOwnedPlaidItem } from "../src/lib/plaid-items.js";

describe("deleteOwnedPlaidItem", () => {
  it("deletes an item owned by the user", async () => {
    const prisma = {
      plaidItem: {
        findFirst: vi.fn().mockResolvedValue({ id: "item-1", accessToken: "access-1" }),
        delete: vi.fn().mockResolvedValue({ id: "item-1" }),
      },
    };
    const removeFromPlaid = vi.fn().mockResolvedValue(undefined);

    const result = await deleteOwnedPlaidItem(prisma, "user-1", "item-1", removeFromPlaid);

    expect(result).toEqual({ id: "item-1" });
    expect(prisma.plaidItem.findFirst).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
    });
    expect(removeFromPlaid).toHaveBeenCalledWith("access-1");
    expect(prisma.plaidItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });

  it("does not delete a missing or foreign item", async () => {
    const prisma = {
      plaidItem: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };

    const removeFromPlaid = vi.fn();

    expect(await deleteOwnedPlaidItem(prisma, "user-1", "item-2", removeFromPlaid)).toBeNull();
    expect(removeFromPlaid).not.toHaveBeenCalled();
    expect(prisma.plaidItem.delete).not.toHaveBeenCalled();
  });
});
