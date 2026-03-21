"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { AgeBracketFilter } from "@/components/filters/age-bracket-filter";

const AGE_BRACKET_PARAM = "age";

/**
 * Hook for managing age bracket filter state with URL sync
 *
 * Usage:
 * ```tsx
 * const { ageBracket, setAgeBracket, queryParam } = useAgeBracketFilter();
 *
 * // Use in API calls
 * fetch(`/api/scores?${queryParam}`);
 * ```
 */
export function useAgeBracketFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse age bracket from URL params
  const ageBracket = useMemo<AgeBracketFilter>(() => {
    const param = searchParams.get(AGE_BRACKET_PARAM);
    if (param === "6-9" || param === "10-12" || param === "13-15") {
      return param;
    }
    return "all";
  }, [searchParams]);

  // Update URL params when filter changes
  const setAgeBracket = useCallback(
    (bracket: AgeBracketFilter) => {
      const params = new URLSearchParams(searchParams.toString());

      if (bracket === "all") {
        params.delete(AGE_BRACKET_PARAM);
      } else {
        params.set(AGE_BRACKET_PARAM, bracket);
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.push(newUrl, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Generate query param string for API calls
  const queryParam = useMemo(() => {
    if (ageBracket === "all") return "";
    return `ageBracket=${ageBracket}`;
  }, [ageBracket]);

  return {
    ageBracket,
    setAgeBracket,
    queryParam,
    isFiltered: ageBracket !== "all",
  };
}

/**
 * Validate if a string is a valid age bracket
 */
export function isValidAgeBracket(value: string | null): value is AgeBracketFilter {
  return value === null || value === "all" || value === "6-9" || value === "10-12" || value === "13-15";
}

/**
 * Parse age bracket from URL search params (for server components)
 */
export function parseAgeBracketParam(searchParams: { [key: string]: string | string[] | undefined }): AgeBracketFilter {
  const param = searchParams[AGE_BRACKET_PARAM];
  const value = Array.isArray(param) ? param[0] : param;

  if (value === "6-9" || value === "10-12" || value === "13-15") {
    return value;
  }
  return "all";
}
