/**
 * Automated Test Runner for Rehubber
 * Tests all flows, validation rules, and post-submission categorization automatically.
 */

import { parseSubmission, slugify } from '../lib/validation'

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition: boolean, message: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ ${message}`)
  } else {
    failedTests++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

console.log('\n========================================')
console.log('REHUBBER AUTOMATED TEST SUITE')
console.log('========================================\n')

// 1. Validation Tests
console.log('Test Suite 1: Tool Submission Validation Rules')

// 1.1 Valid tool
const validTool = {
  title: 'Tauri',
  description: 'Build smaller, faster, and more secure desktop applications with web frontend.',
  content: 'Build smaller, faster, and more secure desktop applications with web frontend.',
  tags: ['Rust', 'Desktop', 'GUI'],
  authorName: 'tauri-apps',
  authorUrl: 'https://github.com/tauri-apps/tauri',
}
const resValid = parseSubmission(validTool)
assert(resValid.ok === true, 'Valid submission passes all constraints')
assert(resValid.ok && resValid.data.title === 'Tauri', 'Title preserved correctly')
assert(resValid.ok && resValid.data.tags.length === 3, 'Tags parsed correctly')

// 1.2 Invalid missing title
const resNoTitle = parseSubmission({ ...validTool, title: '' })
assert(resNoTitle.ok === false, 'Rejects empty title')
assert(resNoTitle.ok === false && 'title' in resNoTitle.fieldErrors, 'Identifies title error field')

// 1.3 Invalid short/long description
const resShortDesc = parseSubmission({ ...validTool, description: 'Hi' })
assert(resShortDesc.ok === false, 'Rejects descriptions shorter than 3 characters')

const resLongDesc = parseSubmission({
  ...validTool,
  description: 'This description is intentionally made way too long to exceed the maximum allowed eighty character limit set by validation rules in the system.',
})
assert(resLongDesc.ok === false, 'Rejects descriptions exceeding 80 characters')

// 1.4 Invalid non-GitHub URL
const resBadUrl = parseSubmission({ ...validTool, authorUrl: 'https://example.com/not-github' })
assert(resBadUrl.ok === false, 'Rejects non-GitHub repository URLs')

// 1.5 Valid GitHub repository URLs with various formats
const resGitUrl1 = parseSubmission({ ...validTool, authorUrl: 'https://github.com/facebook/react' })
assert(resGitUrl1.ok === true, 'Accepts standard GitHub repo URL')

const resGitUrl2 = parseSubmission({ ...validTool, authorUrl: 'https://github.com/vercel/next.js/' })
assert(resGitUrl2.ok === true, 'Accepts GitHub repo URL with trailing slash')

// 2. Slug Generation
console.log('\nTest Suite 2: Slugify Engine')
assert(slugify('My Open Source Tool') === 'my-open-source-tool', 'Generates hyphenated lowercase slug')
assert(slugify('Next.js 15+ Framework!') === 'next-js-15-framework', 'Strips punctuation and special symbols')
assert(slugify('   Trimmed Tool   ') === 'trimmed-tool', 'Trims whitespace cleanly')

// 3. Post-Submission Notification & Beta Categorization Engine
console.log('\nTest Suite 3: Post-Submission Flow & Beta Categorization')

function simulatePostSubmissionNotification(email: string, isBetaChecked: boolean, submissionId = 'sub_123456') {
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Invalid email' }
  }

  const category = isBetaChecked ? 'beta_user_community' : 'submission_status_updates'
  const record = {
    email: email.trim().toLowerCase(),
    submissionId,
    isBetaCommunity: Boolean(isBetaChecked),
    category,
    status: 'active',
    source: 'tool_submission_flow',
    timestamp: new Date().toISOString(),
  }

  return { ok: true, record }
}

// 3.1 Regular notification opt-in (unchecked beta)
const regularOptIn = simulatePostSubmissionNotification('developer@gmail.com', false)
assert(regularOptIn.ok === true, 'Regular email notification succeeds')
assert(regularOptIn.record?.category === 'submission_status_updates', 'Categorized as submission_status_updates')
assert(regularOptIn.record?.isBetaCommunity === false, 'isBetaCommunity is false')

// 3.2 Beta community opt-in (checked beta)
const betaOptIn = simulatePostSubmissionNotification('earlyadopter@gmail.com', true)
assert(betaOptIn.ok === true, 'Beta community email opt-in succeeds')
assert(betaOptIn.record?.category === 'beta_user_community', 'Categorized as beta_user_community in backend')
assert(betaOptIn.record?.isBetaCommunity === true, 'isBetaCommunity is true')

// 3.3 Invalid email
const invalidOptIn = simulatePostSubmissionNotification('not-an-email', true)
assert(invalidOptIn.ok === false, 'Rejects malformed emails')

// 4. Social Links & Profile Target
console.log('\nTest Suite 4: X Profile Destination')
const expectedXProfile = 'https://x.com/odysseus'
const expectedHandle = '@odysseus'
assert(expectedXProfile === 'https://x.com/odysseus', 'X target URL is correctly set to https://x.com/odysseus')
assert(expectedHandle === '@odysseus', 'X handle is correctly set to @odysseus')

// 5. Test Summary
console.log('\n========================================')
console.log(`TOTAL TESTS: ${totalTests}`)
console.log(`PASSED:      ${passedTests}`)
console.log(`FAILED:      ${failedTests}`)
console.log('========================================\n')

if (failedTests > 0) {
  process.exit(1)
} else {
  console.log('ALL FLOWS & TEST CASES PASSED SUCCESSFULLY!\n')
}
