# Error Audit And Fix Plan

Last updated: 2026-04-25

## Scope

This document captures the concrete errors and release-blocking risks identified in the current codebase during the latest review pass.

It is not a claim that every possible bug in the app has been found. It is a working list of the issues that were verified from the current source and build behavior.

## Current status

- Frontend build passes with `npm run build`
- Backend build passes with `npm run build`
- Highest-plan premium gating logic is currently correct
  - `src/components/shared/PremiumGate.tsx:13-27`
- The codebase still has runtime and user-facing defects that should be fixed before calling the current portal/admin work complete

## Findings

### 1. Portal invite flow can report success even when the email was not sent

Severity: High

Evidence:

- `server/src/services/emailService.ts:24-47`
  - `sendEmail(...)` logs failures and returns without rethrowing
- `server/src/routes/clients.ts:129-160`
  - `createPortalInvite(...)` awaits `sendPortalInviteEmail(...)`, but does not receive any delivery result
- `server/src/routes/clients.ts:513-518`
  - the route always responds with `message: 'Portal invite sent'`

Why this matters:

- Staff can believe a client was invited successfully when the email actually failed to send
- This is already known from runtime testing, where SMTP auth failed while the endpoint still completed
- It creates support noise, broken onboarding, and false audit confidence

Fix plan:

1. Change `sendEmail(...)` to return structured delivery status instead of always resolving silently
2. Distinguish between:
   - credentials missing
   - transport failure
   - timeout
   - successful send
3. Update `createPortalInvite(...)` to surface delivery status back to the route
4. Change the API response so the clinic UI can show:
   - `invite created, email delivered`
   - `invite created, email delivery failed`
5. Add audit detail that records delivery outcome, not just invite creation
6. Add a regression test for failed SMTP delivery so the route cannot keep claiming full success

Recommended order:

1. Backend delivery status contract
2. Route response update
3. Clinic toast/UI message update
4. Tests

### 2. Command palette selected-row highlighting is broken

Severity: Medium

Evidence:

- `src/components/shared/CommandPalette.tsx:150`
- `src/components/shared/CommandPalette.tsx:180`
- `src/components/shared/CommandPalette.tsx:210`

Problem:

- `isSelected` is computed with `flatResults.indexOf({ ...item, type: '...' }) === selectedIndex`
- That creates a new object each time, so `indexOf(...)` compares a fresh object reference against the array and does not match the original entry

Why this matters:

- Keyboard navigation state and visual highlighting can drift apart
- Hover and arrow-key navigation feel unreliable
- This degrades one of the app's main navigation shortcuts

Fix plan:

1. Replace `indexOf({...})` with a stable key comparison
2. Build `flatResults` with an explicit `selectionKey`, for example:
   - `client:<id>`
   - `patient:<id>`
   - `inventory:<id>`
3. Compute `isSelected` by comparing the row's stable key to the selected row's stable key
4. Add a lightweight interaction test for:
   - arrow down/up
   - hover
   - enter to select

Recommended order:

1. Refactor selection identity
2. Verify keyboard behavior manually
3. Add test coverage

### 3. User-facing text has mojibake / encoding corruption in multiple places

Severity: Medium

Evidence:

- `src/App.tsx:63`
  - default currency symbol is `â‚¦`
- `src/components/shared/CommandPalette.tsx:194`
  - species separator renders as `â€¢`
- `src/components/shared/CommandPalette.tsx:228`
  - SKU separator renders as `â€¢`
- `src/components/SubscriptionPlans.tsx:243`
- `src/components/SubscriptionPlans.tsx:259`
  - unlimited usage renders as `âˆž`
- `server/src/services/emailService.ts:27-28`
- `server/src/services/emailService.ts:39-45`
  - console/status text contains corrupted symbols
- `server/src/services/emailService.ts:93`
- `server/src/services/emailService.ts:123`
- `server/src/services/emailService.ts:132`
- `server/src/services/emailService.ts:141`
- `server/src/services/emailService.ts:151`
  - email template content contains corrupted copyright, icon, and dash characters

Why this matters:

- The app looks broken in visible UI
- Emails and status messaging can appear unprofessional or confusing
- It increases the chance of copy/paste and formatting bugs spreading into more screens

Fix plan:

1. Normalize the affected files to UTF-8 without BOM
2. Replace corrupted characters with clean ASCII or intended Unicode:
   - `Naira symbol`
   - bullet separators
   - infinity symbol
   - copyright marker
   - em dash or plain hyphen
3. Prefer ASCII fallbacks where possible in backend email templates if encoding uncertainty remains
4. Do one targeted sweep across:
   - shared UI components
   - subscription screens
   - portal screens
   - email templates
5. Add a quick review checklist for user-facing copy before release

Recommended order:

1. Fix shared UI strings first
2. Fix email templates next
3. Re-check rendered portal and settings screens manually

### 4. Email templates contain corrupted decorative symbols and footer text

Severity: Medium

Evidence:

- `server/src/services/emailService.ts:93`
- `server/src/services/emailService.ts:123`
- `server/src/services/emailService.ts:132`
- `server/src/services/emailService.ts:141`
- `server/src/services/emailService.ts:151`

Why this matters:

- Verification and reset emails are part of the trust surface of the app
- Broken characters in authentication emails make the product feel unreliable even when the logic works

Fix plan:

1. Remove decorative emoji from email HTML unless they are known to render correctly
2. Replace corrupted symbols with clean text equivalents
3. Render-test the generated HTML in a real mailbox or mail preview tool
4. Reuse one shared footer string so the same corruption does not reappear in multiple templates

Note:

- This issue overlaps with Finding 3, but is called out separately because it affects auth and invite emails directly

### 5. Frontend bundle size is above the warning threshold

Severity: Low

Evidence:

- Latest frontend build emitted a large chunk warning
- Main bundle is still over 1.1 MB minified

Why this matters:

- Slower first-load performance
- More noticeable on lower-end devices or poor networks
- This becomes more important as portal and admin features keep growing

Fix plan:

1. Split large feature surfaces with dynamic imports:
   - AI hub
   - reports
   - portal-heavy screens
   - export/report tooling
2. Add manual chunking for known heavy vendor groups if needed
3. Re-measure bundle output after splitting

Recommended order:

1. Fix correctness issues first
2. Address bundle size after the invite and encoding fixes land

## Fix order

Recommended execution sequence:

1. Fix portal invite delivery truthfulness
2. Fix mojibake in UI and email templates
3. Fix command palette selection behavior
4. Add regression tests for invite flow and command palette navigation
5. Reduce bundle size

## Suggested implementation tickets

These can be turned into work items directly:

- `INV-01` Portal invite delivery status and UI feedback
- `TXT-01` Encoding cleanup across UI and email templates
- `NAV-01` Command palette selection state fix
- `TEST-01` Invite flow regression coverage
- `TEST-02` Command palette keyboard/hover interaction coverage
- `PERF-01` Frontend code splitting for heavy views

## Validated items

The following were checked and are not current errors:

- Premium gate highest-plan bypass works
  - `src/components/shared/PremiumGate.tsx:22-27`
- Frontend build succeeds
- Backend build succeeds
