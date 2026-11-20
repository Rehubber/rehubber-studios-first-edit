# 🚀 Deployment Guide - Ready to Deploy

## Summary of Changes

Two important fixes have been committed and are ready to deploy:

### 1. **Upvote Persistence Fix** (Commit: `a5b685f`)
- **Problem Fixed**: Upvoted items were losing their position after page refresh
- **Solution**: 
  - Enrich initial page data with live Firestore upvote counts
  - Apply sort on component mount to reflect current state
  - Upvotes now persist across all page reloads and next-day visits
- **Files Changed**: `lib/rules.ts`, `components/rule-explorer.tsx`
- **Performance Impact**: +1 batch Firestore query on initial page load (acceptable)

### 2. **GitHub URL Validation Improvement** (Commit: `77ace9a`)
- **Problem Fixed**: Repository URL field only accepted `https://` format
- **Solution**:
  - Allow GitHub URLs with or without `https://` prefix
  - Better error messages guide users on acceptable formats
  - More user-friendly for copy-pasted links
- **Files Changed**: `lib/validation.ts`, `components/submit-form.tsx`
- **UX Impact**: Makes form more flexible and forgiving

## Deployment Steps

### Automatic Deployment (Recommended)
Your repository has GitHub Actions configured to auto-deploy on `main` branch push.

**Steps:**
1. Push commits to main branch (or they're already there if using this workspace)
2. GitHub Actions automatically triggers `.github/workflows/deploy-directory.yml`
3. Workflow:
   - ✓ Installs dependencies
   - ✓ Exports Firestore rules (requires `FIREBASE_SERVICE_ACCOUNT_JSON` secret)
   - ✓ Builds Next.js static site
   - ✓ Deploys to Cloudflare Pages using Wrangler
4. Site goes live at `https://www.rehubber.com` (or your configured domain)

### Manual Deployment
If you need to deploy manually:

```bash
# 1. Install dependencies
npm ci

# 2. Export directory (requires Firebase Admin credentials)
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_SERVICE_ACCOUNT_JSON='your-service-account-json'
npm run export:directory -- --require-firestore

# 3. Build static site
export NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
# ... (see .github/workflows/deploy-directory.yml for all env vars)
npm run build

# 4. Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name rehubber-directory --branch main
```

## Required Secrets & Variables

Your GitHub repository must have these configured for auto-deployment:

### Secrets (Settings → Secrets and variables → Actions):
- `FIREBASE_SERVICE_ACCOUNT_JSON` - Firebase Admin SDK key (JSON format)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages permissions

### Variables (Settings → Secrets and variables → Actions):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`

**Status Check:** All these should already be configured. If deployment fails, check that these are set in your repository settings.

## Post-Deployment Verification

### Test 1: Upvote Persistence ✓
1. Visit https://www.rehubber.com
2. Find any tool and click the upvote button
3. Tool should move to top
4. Refresh page → Tool should STILL be at top
5. Close browser/tab
6. Return next day → Tool should STILL be at top

### Test 2: GitHub URL Validation ✓
1. Visit https://www.rehubber.com/submit
2. Try submitting with these URL formats (all should work):
   - `github.com/owner/repo`
   - `https://github.com/owner/repo`
   - `http://github.com/owner/repo`
3. All formats should be accepted without error

### Test 3: Build Success ✓
Check GitHub Actions workflow output:
1. Go to repository → Actions tab
2. Find latest "Deploy static directory to Cloudflare Pages" workflow
3. Check that all steps passed (green checkmarks)
4. Specifically verify: "Export published Firestore rules" and "Deploy to Cloudflare Pages" steps

## Rollback Instructions

If you need to revert these changes:

```bash
# Revert last 2 commits (GitHub URL fix and Upvote fix)
git revert HEAD~1 HEAD --no-edit
git push origin main

# This will trigger GitHub Actions to deploy the reverted code
```

Or manually revert specific commits:
```bash
git revert 77ace9a  # GitHub URL fix
git revert a5b685f  # Upvote persistence fix
git push origin main
```

## Deployment Timeline

| Time | Action | Status |
|------|--------|--------|
| Commit | 2 fixes committed to main | ✓ Ready |
| GitHub Actions | Auto-triggered on push | Automatic |
| Build | ~2-3 minutes | In Progress |
| Deploy | Cloudflare Pages update | In Progress |
| Live | Site updated | ~5-10 min total |

## Monitoring After Deployment

### Key Metrics to Check:
1. **Firestore Read Usage** - Should see ~16 additional reads per initial page visit
2. **Cloudflare Cache Hits** - Pages should still be highly cached
3. **Error Logs** - Monitor for Firestore connection issues
4. **User Feedback** - Upvotes now persisting across refreshes

### Setting Up Alerts:
See line 108 in README.md for Firestore quota alerts:
> Create Cloud Monitoring email alert policies on daily document reads and writes at approximately 80% of the Spark allowance (40,000 reads and 16,000 writes).

## Success Indicators

✅ **Upvote Persistence Fix is Working:**
- Upvoted items stay at top after page refresh
- Sort order consistent across all page reloads
- Firestore upvote data being read on page load

✅ **GitHub URL Validation is Working:**
- Form accepts URLs without `https://`
- Error messages are helpful and clear
- Form validation happens client-side instantly

✅ **No Regressions:**
- Page load times acceptable (similar to before)
- No Firestore connection errors in logs
- Cache behavior unchanged for subsequent pages
- Admin submissions still working

## Support & Troubleshooting

### "Build failed: Cannot find module"
- Run `npm ci` and redeploy
- Check that all dependencies are in package.json

### "Deploy failed: Invalid Cloudflare token"
- Verify `CLOUDFLARE_API_TOKEN` secret is set correctly
- Ensure token has Pages deployment permissions
- Check token hasn't expired

### "Upvotes not updating after refresh"
- Clear browser cache
- Check Firebase credentials in deploy environment
- Verify Firestore rules are deployed (`firebase deploy --only firestore:rules`)

### "GitHub URL validation too strict"
- Validation logic is in `lib/validation.ts`
- Adjust regex or URL parsing if needed
- Remember to redeploy after changes

## Questions?

- 📖 See `README.md` for full documentation
- 📋 See `BEFORE_AFTER.md` for visual comparison of fixes
- 🔍 See `IMPLEMENTATION_SUMMARY.md` for technical details
- 💬 Reach out to Copilot or your team for support

---

**Ready to deploy? Push to main branch or trigger GitHub Actions manually!**
