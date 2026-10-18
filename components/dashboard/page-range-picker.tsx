'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { pagesToRange, parsePageRange } from '@/lib/print'

interface PageRangePickerProps {
  totalPages: number
  selectedPages: number[]
  onChange: (pages: number[]) => void
}

const MAX_GRID_PAGES = 120

export function PageRangePicker({ totalPages, selectedPages, onChange }: PageRangePickerProps) {
  const [rangeText, setRangeText] = useState(() => pagesToRange(selectedPages))
  const [error, setError] = useState<string | null>(null)
  const selectedSet = new Set(selectedPages)
  const allPages = Array.from({ length: totalPages }, (_, i) => i + 1)

  function applyPages(pages: number[]) {
    onChange(pages)
    setRangeText(pagesToRange(pages))
    setError(null)
  }

  function handleRangeInput(value: string) {
    setRangeText(value)
    const result = parsePageRange(value, totalPages)
    setError(result.error)
    onChange(result.error ? [] : result.pages)
  }

  function togglePage(page: number) {
    const next = selectedSet.has(page)
      ? selectedPages.filter((p) => p !== page)
      : [...selectedPages, page].sort((a, b) => a - b)
    applyPages(next)
  }

  const presets = [
    { label: 'All', pages: allPages },
    { label: 'Odd', pages: allPages.filter((p) => p % 2 === 1) },
    { label: 'Even', pages: allPages.filter((p) => p % 2 === 0) },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="page-range" className="text-sm font-medium">
          Page range
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selectedPages.length} of {totalPages} selected
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="page-range"
          value={rangeText}
          onChange={(e) => handleRangeInput(e.target.value)}
          placeholder="e.g. 1-5, 8, 11-13"
          aria-invalid={Boolean(error)}
          aria-describedby="page-range-hint"
          className="h-9 flex-1 font-mono"
        />
        <div className="flex gap-1.5" role="group" aria-label="Quick select">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={preset.pages.length === 0}
              onClick={() => applyPages(preset.pages)}
              className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 sm:flex-none"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p
        id="page-range-hint"
        className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
      >
        {error ?? 'Type ranges or tap pages below to include or exclude them.'}
      </p>

      {totalPages <= MAX_GRID_PAGES && (
        <div
          className="grid max-h-48 grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-12"
          role="group"
          aria-label="Toggle individual pages"
        >
          {allPages.map((page) => {
            const isSelected = selectedSet.has(page)
            return (
              <button
                key={page}
                type="button"
                onClick={() => togglePage(page)}
                aria-pressed={isSelected}
                aria-label={`Page ${page}`}
                className={cn(
                  'flex aspect-[3/4] items-center justify-center rounded-md border font-mono text-xs tabular-nums transition-colors',
                  isSelected
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40',
                )}
              >
                {page}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
