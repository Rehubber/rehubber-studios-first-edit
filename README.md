# Rules Directory

A static, paginated directory hosted on Cloudflare Pages, with Firebase Authentication and Firestore used directly from the browser for submissions, moderation, and upvotes.

## Architecture

- The build exports published Firestore rules into compact JSON pages, then generates a static Next.js export in `out/`.
- The homepage is static HTML with the first 24 rules. “Load more” fetches static JSON files from the CDN, not Firestore.
- Homepage links to individual tools use the directory manifest to load and highlight the matching card, including tools on later pages.
- Additional JSON pages are cached in `localStorage` for one hour.
- Submissions are written directly to the private `submissions` collection and stay pending until a moderator approves them.
- Moderation and voting use the Firebase Web SDK. Firestore Security Rules authorize each operation; the `/admin` route being hard to guess is not a security control.
- Upvotes require GitHub sign-in and are limited to one vote per Firebase account per rule. The current voter sees an optimistic update immediately; directory totals are refreshed when the static site is next deployed.
- The static site does not include Firebase Admin credentials. The export and one-time seed scripts use a service account only in the local environment or GitHub Actions.

## Firebase setup

1. Create a Firebase project and choose the **Spark** plan. Create a Cloud Firestore database in **Standard** edition.
   The browser, export, and admin clients all use the `(default)` database; keep the Firebase project ID consistent across the web app config and server credentials.
2. Register a Firebase Web App. Put its API key, auth domain, project ID, and app ID in `.env.local` using the `NEXT_PUBLIC_FIREBASE_*` names in `.env.example`.
3. In **Authentication → Sign-in method**, enable **GitHub**. Create a GitHub OAuth App and configure its authorization callback URL as:

   ```text
   https://<firebase-project-id>.firebaseapp.com/__/auth/handler
   ```

   Enter the GitHub OAuth client ID and secret in Firebase Authentication. Add `localhost` and your Cloudflare Pages domain to Authentication's authorized domains. Keep the GitHub OAuth secret in Firebase Console; it is not a frontend environment variable.
4. Configure Firebase App Check for the web app with reCAPTCHA Enterprise (Fraud Defense). Create a score-based web key without a checkbox challenge, allow the production domains, and register that key with the web app in App Check. Set the same key as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` for the site build. Use a separate development key instead of adding `localhost` to the production key. Test first, then enable App Check enforcement for Cloud Firestore.
5. Deploy Firestore rules and indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

6. If the project already has checked-in rules, seed them once before switching the public directory to Firestore data:

   ```bash
   node scripts/seed-approved-rules.mjs
   ```

   This one-time script requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env.local`. Never use these credentials in frontend variables or commit them.
7. For additive CSV imports, use a CSV with `name`, `description`, and `repository` columns (a header row is optional). Preview first; existing slugs are skipped and never overwritten:

   ```bash
   npm run import:directory -- "path/to/tools.csv"
   npm run import:directory -- "path/to/tools.csv" --apply
   ```

   The importer requires Firebase Admin credentials in `.env.local`, verifies the configured project, and sets new tools' counters to zero. After importing, run the directory deployment workflow to publish the additions.
8. Open `/admin` and sign in with GitHub. The page shows the account's Firebase UID. In the Firebase Console, create `moderators/<UID>` with the boolean field `enabled: true`. Only accounts with this Firestore document can read the queue or moderate.

## Cloudflare Pages deployment

1. Install Wrangler and create a Cloudflare Pages project using Direct Upload. From a terminal, run `npx wrangler pages project create`, then enter `rehubber-directory` as the project name and `main` as the production branch. Direct Upload projects cannot later be converted to Git-integrated Pages projects. Do not configure Pages to run its own Next.js build; GitHub Actions builds the static `out/` directory and uploads it.
2. In your GitHub repository settings, add these **Actions variables**:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Google Analytics 4 measurement ID, such as `G-ABC123DEF4`)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_PAGES_PROJECT` (`rehubber-directory`)
   Enter these as raw values without surrounding quote characters.
   The export uses `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so the Web App settings and Firestore service account must belong to the same project.
3. Add these **Actions secrets**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: service-account JSON for exporting published rules. Grant only the permissions needed to read the published rules collection.
   - `CLOUDFLARE_API_TOKEN`: a Cloudflare API token scoped to Pages project deployments for this account.
4. The workflow at `.github/workflows/deploy-directory.yml` deploys when relevant changes are pushed to `main`. After approving a submission in `/admin`, manually run **Actions → Deploy static directory to Cloudflare Pages → Run workflow** to publish the updated rules and vote counts. The build queries Firestore and fails rather than falling back to checked-in JSON if export credentials are missing.
5. Add the Cloudflare Pages domain to Firebase Authentication's authorized domains and to App Check's allowed domains. Set the Cloudflare API token permission to **Account → Cloudflare Pages → Edit** and restrict it to the account that owns this project.

## Google Search Console and Analytics

- Add the `NEXT_PUBLIC_GA_MEASUREMENT_ID` GitHub Actions variable to enable GA4. Without a valid `G-...` measurement ID, the site does not load the Google Analytics script or send events.
- GA4 reports standard page views and the site's custom actions: `listing_viewed` is sent when at least half of a tool card is visible; `listing_clicked`, `listing_shared`, and `outbound_clicked` are tracked separately with listing context. Submission tracking includes `listing_submission_started`, step/failure/follow-up events, and `listing_submitted` only after Firestore accepts a submission. The fallback that only saves locally uses a different event and is not counted as a submitted listing.
- No email address, submitter name, Firebase UID, or message content is sent to GA4. GA4's anonymous client identification distinguishes new and returning visitors without using the Firebase account ID.
- Register the event parameters you want to use as dimensions in **GA4 Admin → Custom definitions** (for example `listing_id`, `listing_name`, `listing_position`, `source`, `destination_domain`, and `destination_type`). Large reports grouped by listing ID may aggregate high-cardinality values.
- Verify the domain in Google Search Console with a DNS TXT record in Cloudflare, then submit `https://www.rehubber.com/sitemap.xml`. The sitemap is generated at build time from the published catalog and excludes the partner booking pages and admin route.
- To connect the properties, use **GA4 Admin → Product links → Search Console Links**, choose the verified Search Console property and the site's web data stream, and confirm the link. Google requires suitable owner/editor access to both properties, so this account-side link cannot be made by a site deployment.
- Configure a Cloudflare Redirect Rule for `rehubber.com/*` → `https://www.rehubber.com/${1}` with a permanent (301) redirect. Cloudflare Pages' `_redirects` file cannot reliably enforce a hostname redirect; the site's canonical metadata and client-side fallback point to `www` in the meantime.

The workflow builds in GitHub Actions and uploads static files and the sponsor Pages Functions with Wrangler. Browsing remains static; the sponsor checkout and Stripe webhook use Pages Functions. The Firestore export reads every published rule once each deployment, so avoid unnecessary redeploys. Direct Upload avoids Pages' Git-integrated build pipeline and its 500 builds/month limit; GitHub Actions minutes, Pages deployment limits, and provider terms still apply. The site remains static and browsable from the CDN between deployments.

For local development, `npm run dev` exports the checked-in JSON files under `content/rules/` and starts Next.js. For a local production build with live rules, provide the service-account environment variables and run `npm run build`. The static output is `out/`; it is not run with `next start`.

## Sponsor payments

The $299, one-week placement uses Stripe-hosted Checkout and starts only after a signed, paid webhook is processed. A checkout temporarily holds the single spot; returning from Stripe is not proof of payment. The checkout session expires after 45 minutes and its expiration webhook releases the hold. Duplicate payment webhooks are idempotent. Only card payments are offered; adaptive currency pricing is disabled.

Before accepting payments:

1. Activate the Stripe account, complete verification and configure its payout bank account in Stripe. Check payout availability, fees, tax settings and receipts in the Stripe dashboard. Payments go to the account that owns the secret key; payout timing is controlled by Stripe.
2. Review any existing `sponsor_bookings/current` record: the previous form could create an active placement without payment. Deploy the Firestore rules in this repository **before** enabling checkout: `firebase deploy --only firestore:rules`. They prevent visitors from creating or replacing paid sponsorships directly. Deploy the site and Pages Functions together using the existing Wrangler workflow.
3. In the Cloudflare Pages project, add encrypted **production secrets** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `FIREBASE_SERVICE_ACCOUNT_JSON`, and the environment variable `SPONSOR_SITE_ORIGIN` (for example `https://www.rehubber.com`, without a trailing slash). The service account must belong to the same Firebase project as the site and have Firestore read/write permissions. Never put these secrets in `NEXT_PUBLIC_*`, the repository, or browser code. Use a dedicated service account and restrict access to its key.
4. In Stripe, create a webhook endpoint at `https://www.rehubber.com/api/sponsor/webhook` for `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Use that endpoint's signing secret. Make sure the key, signing secret, and Stripe account are all from the same test or live mode. Configure rate limiting or a WAF rule for `/api/sponsor/checkout`; an unauthenticated visitor can otherwise hold the single spot.
5. Test first with a Stripe **test** key, a test webhook, and a separate Firebase project / Pages environment. Use the actual Pages Functions environment, not `next dev` alone. Verify a successful test payment activates exactly one placement, a declined payment does not, an abandoned session releases its hold, duplicate webhooks do not restart the week, the receipt is delivered, and the Stripe dashboard reports the payment. Then configure production with live credentials and repeat a controlled live test. Do not mix test and live webhooks or share a Firebase project between them.

The private `sponsor_checkout/current` and `sponsor_payments` documents are server-only. If Stripe creation fails ambiguously or a webhook is undelivered, the hold deliberately remains in place rather than risking a second sale. Inspect Cloudflare function logs, the pending document's `reservationId`, and Stripe session/event records; retry failed webhook delivery in Stripe. **Do not clear a pending hold until you have established that no corresponding Stripe session can still be paid and no payment succeeded.** Refunds and disputes require manual handling in Stripe and do not automatically remove an active placement. Monitor failed webhook deliveries and payments requiring reconciliation. The local focused tests run with `npx tsx scripts/test-sponsor.ts`.

## Quotas, traffic, and alerts

The Spark plan prevents Firebase usage from becoming a bill, but requests may fail when quotas are exceeded. Firestore's documented free quota is 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored data, and 10 GiB/month egress. Check the Firebase Console for the project's current quotas and actual usage.

Static browsing avoids Firestore reads per visitor. Each deployment reads all published rules; if there are `N` rules, one export uses about `N` document reads. Each successful upvote uses two writes. Keep the exported dataset and deployment frequency in view as the directory grows.

Cloudflare Pages serves static assets from its CDN; the Free plan documents static asset requests as free and unlimited. This is a better fit than Firebase Hosting for high-volume static traffic, but it is not a guarantee of availability at any traffic level. Keep the initial page and assets small, avoid Functions/Workers on the browsing path, and review Cloudflare's current limits and terms.

For Firestore, create Cloud Monitoring email alert policies on daily document reads and writes at approximately 80% of the Spark allowance (40,000 reads and 16,000 writes). Firestore metrics are sampled each minute and can take up to four minutes to appear; alerts warn but do not reserve quota or stop requests. Check Cloudflare Pages analytics for deployment and traffic status. Billing budget alerts are for billed spending, not Firebase Spark quota alerts.

## Security and voting limits

- Firebase Web App config values are public identifiers. Security Rules, Authentication, and App Check protect Firebase resources; hiding these values does not.
- Pending submissions are visible only to moderators. GitHub-authenticated submitters may create a pending item but cannot publish or alter it afterward.
- Moderators are enabled by adding their Firebase UID to the `moderators` collection through the Firebase Console.
- Votes use an authenticated Firebase UID and a unique vote document per rule. Firestore Rules require the vote record and counter increment to happen atomically. This prevents repeat votes by one account, not by a person who creates multiple GitHub accounts.
- Browser-local vote state is only a convenience. Firestore is authoritative.
- Static vote counts may remain stale until the next deployment. Each voter sees their own successful vote immediately; public totals update when the new snapshot is published.
