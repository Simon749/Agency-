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

atsk_c81b5cb592b2a91b422e35aff3174c20cad2f6958745f131c957df9e70bd2db67b6173dd

npx drizzle-kit generate
npx drizzle-kit migrate

Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
Get-MpComputerStatus | Select-Object IsTamperProtected, RealTimeProtectionEnabled
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath

# work inside the Linux filesystem, not /mnt/c, for real performance
cd ~
git clone <your repo>   # or copy the project in
cd rem
npm install
npx drizzle-kit push
npm run db:seed


// route.ts — report what the orchestrator actually knows
const summary = await runMonthlyBilling(targetMonth);


Setting a custom Cache-Control header can break Next.js development behavior.
○ Compiling proxy ...
- Experiments (use with caution):
  · optimizePackageImports
  · serverActions

Clerk - DEPRECATION WARNING: "createRouteMatcher" is deprecated and will be removed in the next major release.
Use resource-based auth checks instead. Move auth checks into each page, layout, API route, or Server Function that accesses protected data. Middleware-based auth checks rely on path matching, which can diverge from how Next.js routes requests and leave protected resources reachable. For a migration guide, see: https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher
Attention: Clerk collects telemetry data from its SDKs when connected to development instances.
The data collected is used to inform Clerk's product roadmap.
To learn more, including how to opt-out from the telemetry program, visit: https://clerk.com/docs/telemetry.


# 1. See both definitions side by side
cat ./db/schema.ts | grep -A 20 'pgTable("buildings"'
cat ./db/schema/buildings.ts


# 2. See which files import from which location
grep -rn "from \"@/db/schema\"" --include="*.ts" --include="*.tsx" .
grep -rn "from \"@/db/schema/" --include="*.ts" --include="*.tsx" .
grep -rn "from \"@/lib/db/schema" --include="*.ts" --include="*.tsx" .


export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
  subscriptionStatus: text("subscription_status").default("TRIAL"),

  // ── Soft delete & termination ──────────────────────────────
  deletedAt: timestamp("deleted_at"),
  terminationReason: terminationReasonEnum("termination_reason"),
  terminatedBy: text("terminated_by"),
  dataExportedAt: timestamp("data_exported_at"),
  gracePeriodEndsAt: timestamp("grace_period_ends_at"),

  // ── Landlord payout config (Gap Closure Tracker Phase E) ──
  defaultCommissionRate: numeric("default_commission_rate", { precision: 5, scale: 2 }).default("0.00"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});


# stop the dev server first, then:
rm -rf .next
rm -rf node_modules/.cache



pnpm ls next react react-dom -r