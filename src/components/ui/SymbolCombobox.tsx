"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type { SymbolOption } from "@/lib/asset-price";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { AssetCategory } from "@/types";

interface Props {
  // "stock" | "crypto" — selects the search provider behind /api/asset-symbols.
  category: AssetCategory;
  defaultValue?: string | null;
  label: string;
  placeholder?: string;
  error?: string;
}

// Searchable ticker picker. The chosen symbol is submitted via a hidden input
// named "symbol", so the surrounding <form> works unchanged. Falls back to free
// text: whatever is typed is the submitted value until an option is picked.
export function SymbolCombobox({ category, defaultValue, label, placeholder, error }: Props) {
  const id = useId();
  const [text, setText] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(text);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce keystrokes so we don't fire a request (and burn Finnhub quota) on
  // every character.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  // Close the dropdown when clicking outside the component.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: options = [] } = useQuery({
    queryKey: keys.assetSymbols(category, debounced),
    queryFn: () =>
      fetchJson<SymbolOption[]>(
        `/api/asset-symbols?category=${category}&q=${encodeURIComponent(debounced)}`,
      ),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  function select(option: SymbolOption) {
    setText(option.value);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-foreground/80 mb-1">
        {label}
      </label>
      {/* Submitted value — the bare ticker. */}
      <input type="hidden" name="symbol" value={text} />
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-4 py-2 border border-line rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-accent-soft"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-line bg-card shadow-lg">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => select(option)}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-accent-soft"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
