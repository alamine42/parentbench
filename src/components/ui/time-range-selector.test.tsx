/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeRangeSelector, timeRangeToDate, type TimeRange } from "./time-range-selector";

describe("TimeRangeSelector", () => {
  it("renders all time range options", () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="ALL" onChange={onChange} />);

    expect(screen.getByText("1M")).toBeInTheDocument();
    expect(screen.getByText("3M")).toBeInTheDocument();
    expect(screen.getByText("6M")).toBeInTheDocument();
    expect(screen.getByText("1Y")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("highlights the selected value", () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="6M" onChange={onChange} />);

    // The aria-pressed is on the button element, which contains the text in a span
    const button6M = screen.getByText("6M").closest("button");
    expect(button6M).toHaveAttribute("aria-pressed", "true");

    const button1M = screen.getByText("1M").closest("button");
    expect(button1M).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange when a different option is clicked", () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="ALL" onChange={onChange} />);

    fireEvent.click(screen.getByText("3M"));
    expect(onChange).toHaveBeenCalledWith("3M");
  });

  it("has accessible group label", () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="ALL" onChange={onChange} />);

    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      "Select time range"
    );
  });
});

describe("timeRangeToDate", () => {
  it("returns null for ALL", () => {
    expect(timeRangeToDate("ALL")).toBeNull();
  });

  it("returns a date for 1M", () => {
    const result = timeRangeToDate("1M");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a date for 3M", () => {
    const result = timeRangeToDate("3M");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a date for 6M", () => {
    const result = timeRangeToDate("6M");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a date for 1Y", () => {
    const result = timeRangeToDate("1Y");
    expect(result).toBeInstanceOf(Date);
  });
});
