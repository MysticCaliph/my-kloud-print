# My Kloud Print

My Kloud Print is a simple web app for managing print orders online. It lets users upload documents, choose print settings, estimate the cost, and submit orders from a clean dashboard.

## Overview

This project is built for a document-printing workflow where the user can:

- upload a PDF or print-ready file
- select page ranges, copies, and color settings
- review a price estimate before submitting
- manage account balance and wallet top-ups
- track print requests through a user-friendly interface

It also includes admin tools for reviewing the system and managing user credit.

## Features

- User account and wallet management
- PDF upload and print configuration
- Price estimation based on selected options
- Order submission flow
- Admin dashboard for operational oversight
- Modern Next.js interface with Tailwind styling

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Start the development server:

```bash
pnpm dev
```

3. Open your browser at:

```text
http://localhost:3000
```

## Project Structure

- `app/` — pages and application routes
- `components/` — reusable UI and dashboard components
- `lib/` — helper logic and shared functionality
- `public/` — static assets
- `supabase/` — database migrations and related setup files

## Notes

This project is intended as a general print-order management application and can be adapted to your own environment, hosting, and database configuration.
