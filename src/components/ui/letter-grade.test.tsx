/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LetterGradeBadge } from "./letter-grade";

describe("LetterGradeBadge", () => {
  it("renders the grade text", () => {
    render(<LetterGradeBadge grade="A+" />);
    expect(screen.getByText("A+")).toBeInTheDocument();
  });

  it("renders all valid grades", () => {
    const grades = [
      "A+", "A", "A-",
      "B+", "B", "B-",
      "C+", "C", "C-",
      "D+", "D", "D-",
      "F",
    ] as const;

    grades.forEach((grade) => {
      const { unmount } = render(<LetterGradeBadge grade={grade} />);
      expect(screen.getByText(grade)).toBeInTheDocument();
      unmount();
    });
  });

  it("applies correct size classes", () => {
    const { rerender } = render(<LetterGradeBadge grade="B" size="sm" />);
    let badge = screen.getByText("B");
    expect(badge.className).toContain("text-xs");

    rerender(<LetterGradeBadge grade="B" size="md" />);
    badge = screen.getByText("B");
    expect(badge.className).toContain("text-sm");

    rerender(<LetterGradeBadge grade="B" size="lg" />);
    badge = screen.getByText("B");
    expect(badge.className).toContain("text-base");
  });

  it("defaults to medium size", () => {
    render(<LetterGradeBadge grade="C" />);
    const badge = screen.getByText("C");
    expect(badge.className).toContain("text-sm");
  });

  it("applies color classes based on grade", () => {
    // High grade - should have green
    const { rerender } = render(<LetterGradeBadge grade="A" />);
    let badge = screen.getByText("A");
    expect(badge.className).toContain("green");

    // Medium grade - should have yellow
    rerender(<LetterGradeBadge grade="C" />);
    badge = screen.getByText("C");
    expect(badge.className).toContain("yellow");

    // Low grade - should have red
    rerender(<LetterGradeBadge grade="F" />);
    badge = screen.getByText("F");
    expect(badge.className).toContain("red");
  });

  it("has rounded-md class for badge styling", () => {
    render(<LetterGradeBadge grade="B+" />);
    const badge = screen.getByText("B+");
    expect(badge.className).toContain("rounded-md");
  });

  it("has font-bold class", () => {
    render(<LetterGradeBadge grade="A-" />);
    const badge = screen.getByText("A-");
    expect(badge.className).toContain("font-bold");
  });
});
