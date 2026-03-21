/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelChip } from "./model-chip";

describe("ModelChip", () => {
  it("renders model name", () => {
    render(<ModelChip name="GPT-4o" />);
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
  });

  it("renders provider name when provided", () => {
    render(<ModelChip name="GPT-4o" provider="OpenAI" />);
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("renders logo when logoUrl is provided", () => {
    render(
      <ModelChip
        name="GPT-4o"
        provider="OpenAI"
        logoUrl="https://example.com/logo.png"
      />
    );
    const logo = screen.getByAltText("OpenAI logo");
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("renders initial letter when no logo", () => {
    const { container } = render(<ModelChip name="GPT-4o" />);
    expect(container.textContent).toContain("G");
  });

  it("shows remove button when onRemove is provided", () => {
    const handleRemove = vi.fn();
    render(<ModelChip name="GPT-4o" onRemove={handleRemove} />);

    const removeButton = screen.getByLabelText("Remove GPT-4o");
    expect(removeButton).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", () => {
    const handleRemove = vi.fn();
    render(<ModelChip name="GPT-4o" onRemove={handleRemove} />);

    fireEvent.click(screen.getByLabelText("Remove GPT-4o"));
    expect(handleRemove).toHaveBeenCalled();
  });

  it("hides remove button when showRemove is false", () => {
    const handleRemove = vi.fn();
    render(
      <ModelChip name="GPT-4o" onRemove={handleRemove} showRemove={false} />
    );

    expect(screen.queryByLabelText("Remove GPT-4o")).not.toBeInTheDocument();
  });
});
