# Fix: Upvoted Items Losing Position After Refresh

## Problem
When users upvoted items on the home page, they temporarily moved to the top. However, after refreshing the page or returning the next day, the items reverted to their original position because the home page was loading **static build-time data** instead of **live Firestore upvote counts**.

## Root Cause
The page was using `getDirectoryPage()` which read from static JSON files (`public/directory/pages/page-1.json`) that contained upvote counts from the last build. Even though votes were being stored in Firestore (the live database), the initial page render always used stale static data.

## Solution
Implemented a two-part fix:

### 1. **Dynamic Upvote Enrichment** (`lib/rules.ts`)
Added `enrichRulesWithLiveUpvotes()` function that:
- Fetches the latest upvote counts from Firestore for each rule on the initial page
- Replaces the stale static upvote counts with live values from the database
- Gracefully falls back to static data if Firestore is unavailable
- Uses efficient batch fetching to minimize database reads

### 2. **Initial Sort Application** (`components/rule-explorer.tsx`)
Added a `useEffect` hook that:
- Runs once on component mount
- Applies the `compareDirectoryRules` sorting function to the initial rules
- Ensures items with upvotes > 0 bubble to the top immediately on page load
- Accounts for items that were upvoted after the initial static export

## Changed Files
1. `lib/rules.ts` - Added live upvote enrichment
2. `components/rule-explorer.tsx` - Added initial sort effect

## How It Works
1. User visits home page
2. Server fetches static page data + enriches with live Firestore upvotes
3. Component mounts and re-sorts based on current upvote counts
4. Items with active upvotes appear at top
5. Upvotes persist across refreshes because Firestore data is always current

## Benefits
- ✅ Upvoted items stay at top after refresh
- ✅ Items maintain correct sort order across page reloads
- ✅ Works when returning after multiple days (as long as upvotes are stored in Firestore)
- ✅ Graceful degradation if Firestore is unavailable
- ✅ Minimal performance impact (batch queries only on initial page load)
