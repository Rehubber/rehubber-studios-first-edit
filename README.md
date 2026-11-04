# Rules Directory

A static, paginated directory hosted on Cloudflare Pages, with Firebase Authentication and Firestore used directly from the browser for submissions, moderation, and upvotes.

## Architecture

- The build exports published Firestore rules into compact JSON pages, then generates a static Next.js export in `out/`.
- The homepage is static HTML with the first 24 rules. “Load more” fetches static JSON files from the CDN, not Firestore.
- Additional JSON pages are cached in `localStorage` for one hour.
- Submissions are written directly to the private `submissions` collection and stay pending until a moderator approves them.
- Moderation and voting use the Firebase Web SDK. Firestore Security Rules authorize each operation; the `/admin` route being hard to guess is not a security control.
- Upvotes require GitHub sign-in and are limited to one vote per Firebase account per rule. The current voter sees an optimistic update immediately; directory totals are refreshed when the static site is next deployed.
- The static site does not include Firebase Admin credentials. The export and one-time seed scripts use a service account only in the local environment or GitHub Actions.

## Firebase setup

1. Create a Firebase project and choose the **Spark** plan. Create a Cloud Firestore database in **Standard** edition.
2. Register a Firebase Web App. Put its API key, auth domain, project ID, and app ID in `.env.local` using the `NEXT_PUBLIC_FIREBASE_*` names in `.env.example`.
3. In **Authentication → Sign-in method**, enable **GitHub**. Create a GitHub OAuth App and configure its authorization callback URL as:

   ```text
   https://<firebase-project-id>.firebaseapp.com/__/auth/handler
   ```

   Enter the GitHub OAuth client ID and secret in Firebase Authentication. Add `localhost` and your Cloudflare Pages domain to Authentication's authorized domains. Keep the GitHub OAuth secret in Firebase Console; it is not a frontend environment variable.
4. Configure Firebase App Check for the web app with reCAPTCHA v3. Set the site key as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`. Test first, then enable App Check enforcement for Cloud Firestore.
5. Deploy Firestore rules and indexes:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

6. If the project already has checked-in rules, seed them once before switching the public directory to Firestore data:

   ```bash
   node scripts/seed-approved-rules.mjs
   ```

   This one-time script requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env.local`. Never use these credentials in frontend variables or commit them.
7. Open `/admin` and sign in with GitHub. The page shows the account's Firebase UID. In the Firebase Console, create `moderators/<UID>` with the boolean field `enabled: true`. Only accounts with this Firestore document can read the queue or moderate.

## Cloudflare Pages deployment

1. Install Wrangler and create a Cloudflare Pages project using Direct Upload. From a terminal, run `npx wrangler pages project create`, then enter `rehubber-directory` as the project name and `main` as the production branch. Direct Upload projects cannot later be converted to Git-integrated Pages projects. Do not configure Pages to run its own Next.js build; GitHub Actions builds the static `out/` directory and uploads it.
2. In your GitHub repository settings, add these **Actions variables**:
   - `FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_PAGES_PROJECT` (`rehubber-directory`)
3. Add these **Actions secrets**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: service-account JSON for exporting published rules. Grant only the permissions needed to read the published rules collection.
   - `CLOUDFLARE_API_TOKEN`: a Cloudflare API token scoped to Pages project deployments for this account.
4. The workflow at `.github/workflows/deploy-directory.yml` deploys when relevant changes are pushed to `main`. After approving a submission in `/admin`, manually run **Actions → Deploy static directory to Cloudflare Pages → Run workflow** to publish the updated rules and vote counts. The build queries Firestore and fails rather than falling back to checked-in JSON if export credentials are missing.
5. Add the Cloudflare Pages domain to Firebase Authentication's authorized domains and to App Check's allowed domains. Set the Cloudflare API token permission to **Account → Cloudflare Pages → Edit** and restrict it to the account that owns this project.

The workflow builds in GitHub Actions and uploads static files with Wrangler; it does not use Firebase Hosting, Firebase App Hosting, a Firebase Cloud Function, or a Pages Function for visitor traffic. The Firestore export reads every published rule once each deployment, so avoid unnecessary redeploys. Direct Upload avoids Pages' Git-integrated build pipeline and its 500 builds/month limit; GitHub Actions minutes, Pages deployment limits, and provider terms still apply. The site remains static and browsable from the CDN between deployments.

For local development, `npm run dev` exports the checked-in JSON files under `content/rules/` and starts Next.js. For a local production build with live rules, provide the service-account environment variables and run `npm run build`. The static output is `out/`; it is not run with `next start`.

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
