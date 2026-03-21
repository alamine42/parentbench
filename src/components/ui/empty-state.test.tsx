/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders no-history variant with defaults", () => {
    render(<EmptyState variant="no-history" />);
    expect(screen.getByText("No score history yet")).toBeInTheDocument();
    expect(screen.getByText(/hasn't been evaluated/)).toBeInTheDocument();
  });

  it("renders no-comparison variant with defaults", () => {
    render(<EmptyState variant="no-comparison" />);
    expect(screen.getByText("Compare AI models")).toBeInTheDocument();
  });

  it("renders no-results variant with defaults", () => {
    render(<EmptyState variant="no-results" />);
    expect(screen.getByText("No matching results")).toBeInTheDocument();
  });

  it("renders no-data variant with defaults", () => {
    render(<EmptyState variant="no-data" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("allows custom title and description", () => {
    render(
      <EmptyState
        variant="no-history"
        title="Custom Title"
        description="Custom description text"
      />
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom description text")).toBeInTheDocument();
  });

  it("renders action button with href", () => {
    render(
      <EmptyState
        variant="no-history"
        action={{ label: "View All", href: "/leaderboard" }}
      />
    );
    const link = screen.getByText("View All");
    expect(link).toHaveAttribute("href", "/leaderboard");
  });

  it("renders action button with onClick", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        variant="no-comparison"
        action={{ label: "Add Model", onClick: handleClick }}
      />
    );
    fireEvent.click(screen.getByText("Add Model"));
    expect(handleClick).toHaveBeenCalled();
  });
});
