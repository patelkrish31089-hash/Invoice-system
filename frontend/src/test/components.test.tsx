import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, Card, Confidence, Empty, RiskChip } from "../components/UI";

describe("UI primitives", () => {
  it("renders a card with title and subtitle", () => {
    render(
      <Card title="Risk tiers" subtitle="Distribution">
        <span>body</span>
      </Card>,
    );
    expect(screen.getByText("Risk tiers")).toBeInTheDocument();
    expect(screen.getByText("Distribution")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("marks badges with a tone class", () => {
    const { container } = render(<Badge tone="danger">Critical</Badge>);
    expect(container.querySelector(".badge")).toHaveClass("danger");
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("clamps confidence into 0-100%", () => {
    render(<Confidence value={0.918} />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it("renders a risk chip with its category", () => {
    render(<RiskChip category="HIGH" score={74} />);
    expect(screen.getByText(/74/)).toBeInTheDocument();
  });

  it("renders an empty state with its message", () => {
    render(<Empty title="No evaluation runs" message="Run the evaluation script." />);
    expect(screen.getByText("No evaluation runs")).toBeInTheDocument();
    expect(screen.getByText("Run the evaluation script.")).toBeInTheDocument();
  });
});
