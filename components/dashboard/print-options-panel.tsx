'use client'

import type { ReactNode } from 'react'
import { Check, Copy, Minus, Plus, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MAX_COPIES,
  type PaperSize,
  type PrintOptions,
  type PrintSide,
} from '@/lib/print'

interface PrintOptionsPanelProps {
  options: PrintOptions
  onChange: (options: PrintOptions) => void
}

interface RadioOption<T extends string> {
  value: T
  label: string
  description: string
  visual?: ReactNode
}

function RadioCardGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string
  legend: string
  value: T
  options: RadioOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                checked
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background/50 hover:border-muted-foreground/40',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.visual}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function PaperIcon({ size }: { size: PaperSize }) {
  return (
    <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-end justify-center">
      <span
        className={cn(
          'rounded-[2px] border border-muted-foreground/60 bg-muted',
          size === 'A4' ? 'h-6 w-[17px]' : 'h-8 w-[19px]',
        )}
      />
    </span>
  )
}

function SideIcon({ side }: { side: 'single' | 'duplex' }) {
  return (
    <span aria-hidden="true" className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center">
      {side === 'duplex' && (
        <span className="absolute top-0.5 left-2 h-6 w-[17px] rounded-[2px] border border-muted-foreground/40 bg-muted/60" />
      )}
      <span
        className={cn(
          'relative h-6 w-[17px] rounded-[2px] border border-muted-foreground/60 bg-muted',
          side === 'duplex' && 'translate-x-1 translate-y-1',
        )}
      />
    </span>
  )
}

export function PrintOptionsPanel({ options, onChange }: PrintOptionsPanelProps) {
  const update = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) =>
    onChange({ ...options, [key]: value })

  const setCopies = (copies: number) =>
    update('copies', Math.min(MAX_COPIES, Math.max(1, Math.floor(copies) || 1)))

  return (
    <section
      aria-labelledby="options-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="options-heading" className="text-base font-semibold">
            Print specifications
          </h2>
        </div>
        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Black &amp; White only
        </span>
      </div>

      <div className="flex flex-col gap-6">
        <RadioCardGroup<PaperSize>
          name="paper"
          legend="Paper size"
          value={options.paperSize}
          onChange={(v) => update('paperSize', v)}
          options={[
            {
              value: 'A4',
              label: 'A4 Paper',
              description: 'Single ৳1.75 / Duplex ৳3.00',
              visual: <PaperIcon size="A4" />,
            },
            {
              value: 'Legal',
              label: 'Legal Paper',
              description: 'Single ৳2.25 / Duplex ৳4.00',
              visual: <PaperIcon size="Legal" />,
            },
          ]}
        />

        <RadioCardGroup<'single' | 'duplex'>
          name="side"
          legend="Print side"
          value={options.side}
          onChange={(v) => update('side', v)}
          options={[
            {
              value: 'single',
              label: 'Single-sided',
              description: 'One page per sheet',
              visual: <SideIcon side="single" />,
            },
            {
              value: 'duplex',
              label: 'Duplex (Both sides)',
              description: 'Saves paper · Discounted rate',
              visual: <SideIcon side="duplex" />,
            },
          ]}
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Copy className="size-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="copies" className="text-sm font-medium">
              Copies
            </label>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-background/50">
            <button
              type="button"
              onClick={() => setCopies(options.copies - 1)}
              disabled={options.copies <= 1}
              aria-label="Decrease copies"
              className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              <Minus className="size-4" />
            </button>
            <input
              id="copies"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COPIES}
              value={options.copies}
              onChange={(e) => setCopies(Number(e.target.value))}
              className="h-10 w-12 [appearance:textfield] bg-transparent text-center font-mono text-sm font-semibold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setCopies(options.copies + 1)}
              disabled={options.copies >= MAX_COPIES}
              aria-label="Increase copies"
              className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
