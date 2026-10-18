'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/print'
import { PageRangePicker } from './page-range-picker'

export interface UploadedPdf {
  file: File
  name: string
  size: number
  pageCount: number
}

interface UploadZoneProps {
  file: UploadedPdf | null
  onFileChange: (file: UploadedPdf | null) => void
  selectedPages: number[]
  onSelectedPagesChange: (pages: number[]) => void
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

async function countPdfPages(file: File) {
  const { PDFDocument } = await import('pdf-lib')
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}

export function UploadZone({
  file,
  onFileChange,
  selectedPages,
  onSelectedPagesChange,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(selected: File | undefined) {
    if (!selected) return
    setError(null)

    const isPdf =
      selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Only PDF files are supported.')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('File is larger than 50 MB.')
      return
    }

    setIsProcessing(true)
    try {
      const pageCount = await countPdfPages(selected)
      onFileChange({ file: selected, name: selected.name, size: selected.size, pageCount })
      onSelectedPagesChange(Array.from({ length: pageCount }, (_, i) => i + 1))
    } catch {
      setError('Could not read this PDF. It may be corrupted.')
    } finally {
      setIsProcessing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeFile() {
    onFileChange(null)
    onSelectedPagesChange([])
    setError(null)
  }

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="upload-heading" className="text-base font-semibold">
          1. Upload document
        </h2>
        <span className="text-xs text-muted-foreground">PDF up to 50 MB</span>
      </div>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFile(e.dataTransfer.files[0])
          }}
          className={cn(
            'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Reading pages…</p>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="size-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  Drag & drop your PDF here
                </p>
                <p className="text-xs text-muted-foreground">or click to browse your files</p>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => inputRef.current?.click()}
                className="mt-1"
              >
                Choose file
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload PDF file"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-background/50 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
                <span className="mx-1.5" aria-hidden="true">·</span>
                {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={removeFile}
              aria-label="Remove file"
            >
              <X />
            </Button>
          </div>

          <PageRangePicker
            totalPages={file.pageCount}
            selectedPages={selectedPages}
            onChange={onSelectedPagesChange}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
