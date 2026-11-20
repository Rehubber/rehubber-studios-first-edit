# Before & After Comparison

## BEFORE (Buggy Behavior)

```
Initial Page Load:
┌─ Home Page ─────────────────────┐
│ 1. Tool C (sortOrder: 1)         │  ← Loaded from static JSON
│ 2. Tool A (sortOrder: 2)         │     with old upvote counts
│ 3. Tool B (sortOrder: 3)         │     (all have upvotes: 0)
└─────────────────────────────────┘

User Action:
  User clicks upvote on Tool A
  
  ✓ React state updates (upvotes: 1)
  ✓ Sort reorders: Tool A moves to position 1
  ✓ Firestore updated with upvotes: 1
  
  Display:
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool A (upvotes: 1) ← moved! │  ← Local state sorted correctly
  │ 2. Tool C (upvotes: 0)          │
  │ 3. Tool B (upvotes: 0)          │
  └─────────────────────────────────┘

User Refreshes Page:
  ✗ Page reloads from static JSON
  ✗ Static JSON still has old data (upvotes: 0 for all)
  ✗ Display reverts to original order
  
  Display:
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool C (upvotes: 0) ← REVERTED│
  │ 2. Tool A (upvotes: 0) ← WRONG!  │  Firestore has the right count,
  │ 3. Tool B (upvotes: 0)          │  but server sent stale data
  └─────────────────────────────────┘

Result: ✗ FAIL - User sees original order despite upvote
```

## AFTER (Fixed Behavior)

```
Initial Page Load:
Server-side:
  1. Load static JSON (old upvote counts)
  2. Query Firestore for current upvote counts
  3. Enrich rules with LIVE data
  4. Return to client
  
  Live Firestore State:
    Tool A: upvotes = 1 ✓ (from previous upvote)
    Tool C: upvotes = 0
    Tool B: upvotes = 0

Client-side:
  ┌─ Home Page ─────────────────────┐
  │ Rules with LIVE upvote counts:  │
  │ Tool A: 1                       │  ← From Firestore (current)
  │ Tool C: 0                       │
  │ Tool B: 0                       │
  └─────────────────────────────────┘
  
  Component mounts:
  → useEffect runs compareDirectoryRules() sort
  
  Sorted Display:
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool A (upvotes: 1) ← at top │
  │ 2. Tool C (sortOrder: 1)        │
  │ 3. Tool B (sortOrder: 3)        │
  └─────────────────────────────────┘

User Upvotes Tool B:
  ✓ React state updates
  ✓ Sort reorders: Tool B moves to top
  ✓ Firestore updated: Tool B upvotes = 1
  
  Display:
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool B (upvotes: 1) ← moved! │
  │ 2. Tool A (upvotes: 1)          │  Sorted by upvotes (desc)
  │ 3. Tool C (upvotes: 0)          │  then by sortOrder
  └─────────────────────────────────┘

User Refreshes Page:
  Server-side (enrichment):
    Tool A: Firestore upvotes = 1 ✓
    Tool B: Firestore upvotes = 1 ✓
    Tool C: Firestore upvotes = 0 ✓
  
  Client-side:
    useEffect sorts with live counts
  
  Display:
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool B (upvotes: 1) ← STAYS! │
  │ 2. Tool A (upvotes: 1)          │
  │ 3. Tool C (upvotes: 0)          │
  └─────────────────────────────────┘

User Returns Next Day:
  ✓ Same enrichment process
  ✓ Firestore still has persisted counts
  ✓ Display is correct
  
  ┌─ Home Page ─────────────────────┐
  │ 1. Tool B (upvotes: 1) ← STILL   │
  │ 2. Tool A (upvotes: 1) THERE!   │
  │ 3. Tool C (upvotes: 0)          │
  └─────────────────────────────────┘

Result: ✓ SUCCESS - Upvotes persist across all page reloads
```

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| **Data Source** | Static JSON only | Static JSON + Firestore enrichment |
| **Upvote Counts** | Stale (from last build) | Current (from Firestore) |
| **Page Refresh** | Upvotes reverted | Upvotes persist |
| **Next Day Visit** | Wrong order | Correct order |
| **Sort Consistency** | Inconsistent | Always correct |
| **Performance** | Minimal | +1 batch query on initial load |
| **Reliability** | Flaky | Reliable |

## Code Changes Summary

### lib/rules.ts
```typescript
// BEFORE
export async function getDirectoryPage(page: number): Promise<DirectoryPage> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) // Returns stale data
}

// AFTER
export async function getDirectoryPage(page: number): Promise<DirectoryPage> {
  const pageData = JSON.parse(await fs.readFile(filePath, 'utf8'))
  const enrichedRules = await enrichRulesWithLiveUpvotes(pageData.rules) // Now returns live data
  return { ...pageData, rules: enrichedRules }
}
```

### components/rule-explorer.tsx
```typescript
// ADDED
useEffect(() => {
  setRules((current) => [...current].sort(compareDirectoryRules)) // Sort with live counts
}, [])
```
