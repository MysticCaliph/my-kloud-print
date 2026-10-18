This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin access

The `/admin` route is protected by Supabase authentication and requires an operator profile. Configure these environment variables before using the route:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The `profiles` table must contain a `role` column and an `id` value matching the authenticated user's ID. Only profiles with `role = 'operator'` are allowed. Missing Supabase configuration or a profile lookup failure blocks access.

Apply the SQL migrations in `supabase/migrations` to enable operator access and authenticated users' own-profile, own-wallet, and own-print-job reads. The account UI intentionally does not allow direct profile updates so users cannot alter privileged profile fields such as `role`.

The admin dashboard loads `print_jobs` with the related `print_tokens(token)` row through a Supabase foreign-key relationship, and refreshes the queue every 15 seconds. Ensure the relationship and the columns queried by `app/admin/page.tsx` exist in Supabase. Order-status changes are written to `print_jobs`; `PENDING` is stored as `QUEUED`.

`GET /api/print/stamp?id={print_job_id}` generates a single 1/16-A4 job slip as an inline PDF. This endpoint requires an authenticated operator and reads the job through the Supabase service-role client.

## Print submission API

The account UI reads `profiles(id, full_name, phone_number)` and `wallets(user_id, balance_poisha)`, converting the wallet balance to taka for display. If the profile row is absent, it falls back to the authenticated user's `full_name` metadata and email. Print orders are read from `print_jobs` using the columns documented below. Configure the corresponding tables and row-level security policies in Supabase.

`POST /api/print/submit` accepts multipart form data and requires a valid Supabase cookie session. The submitted `userId` must match the authenticated user. It accepts the uploaded PDF and its `totalPages`, verifies the page count without modifying the document, generates a separate 1/16-A4 stamp PDF, and sends both the stamp and original PDF to Telegram. The route expects `atomic_deduct_print_cost(p_user_id, p_amount_poisha)` to return `true` (or an object with `success: true` or `deducted: true`) only after the wallet debit succeeds. Print pricing is verified server-side against `COLOR_RATES`, and the submitted page count must match the PDF.

The route inserts `user_id`, `token`, `customer_phone`, `delivery_option`, `total_pages`, `color_mode`, `copies`, `total_cost_poisha`, `telegram_file_id`, `file_storage_path`, and `status` into `print_jobs`, then inserts `token` and `print_job_id` into `print_tokens`. No delivery address is collected or inserted. The optional delivery preference is stored in `delivery_option`; optional `deliveryNotes` are included in the Telegram caption and default to `None`. `telegram_file_id` is updated after Telegram returns the uploaded document ID; `file_storage_path` remains null. Ensure both tables and their columns match these names before enabling production submissions. If database insertion or Telegram delivery fails after deduction, the route calls `atomic_wallet_topup(p_user_id, p_amount_poisha)` to refund the charged amount.

`POST /api/payment/bkash/create` currently returns HTTP 503 as a safe placeholder. It does not initiate a real bKash payment or modify the wallet. The wallet transaction ledger is not yet backed by a configured transaction table.

`POST /api/admin/topup` accepts `{ "targetUserId": "...", "amountBdt": 100 }` and requires an authenticated operator. It converts the amount to integer poisha and invokes `atomic_wallet_topup` using the Supabase service-role client.

The operator-only `/admin/credits` page loads profiles with wallet balances through the operator-authenticated `GET /api/admin/users` endpoint, then filters the list locally by name, email, or phone. Operators can add wallet credit from each user's row; the list and selected balance refresh after a successful top-up.
