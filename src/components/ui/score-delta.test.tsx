/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreDelta, deltaToTrend } from "./score-delta";

describe("ScoreDelta", () => {
  it("renders positive delta with plus sign", () => {
    render(<ScoreDelta delta={5.5} />);
    expect(screen.getByText("+5.5")).toBeInTheDocument();
  });

  it("renders negative delta with minus sign", () => {
    render(<ScoreDelta delta={-3.2} />);
    // Uses proper minus sign (−) not hyphen (-)
    expect(screen.getByText("−3.2")).toBeInTheDocument();
  });

  it("renders zero delta without sign", () => {
    render(<ScoreDelta delta={0} />);
    expect(screen.getByText("0.0")).toBeInTheDocument();
  });

  it("renders in percentage mode", () => {
    render(<ScoreDelta delta={10.5} mode="percentage" />);
    expect(screen.getByText("+10.5%")).toBeInTheDocument();
  });

  it("hides sign when showSign is false", () => {
    render(<ScoreDelta delta={5} showSign={false} />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });

  it("applies different size classes", () => {
    const { container, rerender } = render(<ScoreDelta delta={5} size="sm" />);
    expect(container.firstChild).toHaveClass("text-xs");

    rerender(<ScoreDelta delta={5} size="md" />);
    expect(container.firstChild).toHaveClass("text-sm");

    rerender(<ScoreDelta delta={5} size="lg" />);
    expect(container.firstChild).toHaveClass("text-base");
  });
});

describe("deltaToTrend", () => {
  it("returns 'up' for positive delta > 0.5", () => {
    expect(deltaToTrend(1)).toBe("up");
    expect(deltaToTrend(5)).toBe("up");
  });

  it("returns 'down' for negative delta < -0.5", () => {
    expect(deltaToTrend(-1)).toBe("down");
    expect(deltaToTrend(-5)).toBe("down");
  });

  it("returns 'stable' for delta within -0.5 to 0.5", () => {
    expect(deltaToTrend(0)).toBe("stable");
    expect(deltaToTrend(0.5)).toBe("stable");
    expect(deltaToTrend(-0.5)).toBe("stable");
  });
});
