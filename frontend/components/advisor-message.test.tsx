import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdvisorMessage } from "./advisor-message";

describe("AdvisorMessage", () => {
  it("renders [n] markers as accent superscript links", () => {
    render(
      <AdvisorMessage
        role="assistant"
        content="Save 3–6 months of expenses [1]."
        sources={[
          {
            n: 1,
            title: "CFPB · Emergency fund basics",
            publisher: "CFPB",
            url: "https://cfpb.gov/x",
            snippet: "Aim for 3 to 6 months.",
          },
        ]}
      />,
    );
    const marker = screen.getByRole("link", { name: "[1]" });
    expect(marker).toBeTruthy();
    expect(screen.getByText(/CFPB · Emergency fund basics/)).toBeTruthy();
    const openLink = screen.getByRole("link", { name: /open source 1/i });
    expect(openLink.getAttribute("href")).toBe("https://cfpb.gov/x");
  });

  it("omits the sources list when none are provided", () => {
    const { container } = render(<AdvisorMessage role="assistant" content="Hi." />);
    const sourcesList = container.querySelector("ol");
    expect(sourcesList).toBeNull();
  });
});
