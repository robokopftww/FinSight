// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DashboardAdvisor } from "./dashboard-advisor";

vi.mock("@/components/advisor-chat", async () => {
  const { useState } = await import("react");

  return {
    AdvisorChat: () => {
      const [draft, setDraft] = useState("");

      return (
        <input
          aria-label="Mock advisor chat state"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      );
    },
  };
});

afterEach(() => cleanup());

describe("DashboardAdvisor", () => {
  test("defers chat mount and preserves local state across button close and reopen", () => {
    const { container } = render(<DashboardAdvisor />);
    const launcher = screen.getByRole("button", { name: "Open WealthLens Advisor" });

    expect(screen.queryByRole("dialog", { name: "WealthLens Advisor" })).toBeNull();
    expect(screen.queryByLabelText("Mock advisor chat state")).toBeNull();
    expect(container.querySelector('[class*="inset-0"]')).toBeNull();
    expect(container.querySelector('[class*="backdrop"]')).toBeNull();

    fireEvent.click(launcher);

    expect(container.querySelector('[class*="inset-0"]')).toBeNull();
    expect(container.querySelector('[class*="backdrop"]')).toBeNull();
    const dialog = screen.getByRole("dialog", { name: "WealthLens Advisor" });
    const chatState = screen.getByLabelText<HTMLInputElement>("Mock advisor chat state");
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(dialog);

    fireEvent.change(chatState, { target: { value: "preserve this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Close WealthLens Advisor" }));

    const hiddenDialog = container.querySelector('aside[aria-label="WealthLens Advisor"]');
    expect(hiddenDialog).toBe(dialog);
    expect(hiddenDialog?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByLabelText<HTMLInputElement>("Mock advisor chat state").value).toBe(
      "preserve this draft",
    );
    const reopenedLauncher = screen.getByRole("button", { name: "Open WealthLens Advisor" });
    expect(document.activeElement).toBe(reopenedLauncher);

    fireEvent.click(reopenedLauncher);

    expect(screen.getByRole("dialog", { name: "WealthLens Advisor" })).toBe(dialog);
    expect(screen.getByLabelText<HTMLInputElement>("Mock advisor chat state").value).toBe(
      "preserve this draft",
    );
  });

  test("Escape hides the mounted chat and returns focus to the labeled launcher", () => {
    const { container } = render(<DashboardAdvisor />);

    fireEvent.click(screen.getByRole("button", { name: "Open WealthLens Advisor" }));
    const dialog = screen.getByRole("dialog", { name: "WealthLens Advisor" });
    const chatState = screen.getByLabelText<HTMLInputElement>("Mock advisor chat state");
    fireEvent.change(chatState, { target: { value: "keep on escape" } });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector('aside[aria-label="WealthLens Advisor"]')).toBe(dialog);
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByLabelText<HTMLInputElement>("Mock advisor chat state").value).toBe(
      "keep on escape",
    );
    const launcher = screen.getByRole("button", { name: "Open WealthLens Advisor" });
    expect(document.activeElement).toBe(launcher);
    expect(screen.queryByRole("button", { name: "Close WealthLens Advisor" })).toBeNull();
  });
});
