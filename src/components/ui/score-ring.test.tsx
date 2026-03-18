/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRing } from "./score-ring";

describe("ScoreRing", () => {
  it("renders the score value", () => {
    render(<ScoreRing score={85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<ScoreRing score={75} size="sm" />);
    expect(screen.getByText("75")).toBeInTheDocument();

    rerender(<ScoreRing score={75} size="md" />);
    expect(screen.getByText("75")).toBeInTheDocument();

    rerender(<ScoreRing score={75} size="lg" />);
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("shows grade when showGrade is true", () => {
    render(<ScoreRing score={85} showGrade />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("does not show grade by default", () => {
    render(<ScoreRing score={85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("has accessible label", () => {
    render(<ScoreRing score={90} showGrade />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute(
      "aria-label",
      "Safety score: 90 out of 100, grade A-"
    );
  });

  it("renders SVG with circles for progress ring", () => {
    const { container } = render(<ScoreRing score={75} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2); // background circle + progress circle
  });
});
