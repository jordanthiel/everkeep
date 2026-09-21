# Everkeep Monetization Plan

## Goal
Decide how and when to charge for Everkeep — a local-first, Electron desktop vault with no backend — so the app can earn revenue without betraying the privacy promise ("never leaves your computer") or holding user data hostage.

## Success Criteria
- User can install for free, experience real value (create a vault, add people/entries, attach files), and understands what they pay for before any paywall.
- Paid tier converts without degrading trust: free vaults remain openable forever, no silent data loss, no cloud account required to keep data.
- One verified payment → signed license activates the installed app offline, survives reinstall/backup moves, and can be re-validated after offline use.
- Price and gating are implementable with Electron + a Merchant of Record (no custom tax/billing backend) and testable in 0.1.x staged rollout.
- Team has a timed trigger for when to flip the paywall (not "someday") and a rollback path.

## Context And Current Facts
- **Product:** Electron + React + TS + SQLite `.everkeep` vault files, TanStack Query + Zustand, `electron-updater` via GitHub Releases. Version `0.1.0` ([package.json](/Users/jthiel/projects/everkeep/package.json:3)), private, UNLICENSED. No monetization code, no license key logic, no entitlements table ([src/main/ipc/handlers.ts](/Users/jthiel/projects/everkeep/src/main/ipc/handlers.ts), [src/main/services/UpdateService.ts](/Users/jthiel/projects/everkeep/src/main/services/UpdateService.ts)).
- **Distribution:** Direct download via `website/` landing page pointing at `github.com/jordanthiel/everkeep/releases/latest` ([website/src/config/downloads.ts](/Users/jthiel/projects/everkeep/website/src/config/downloads.ts)), DMG/NSIS on GitHub, updater checks `latest.yml` / `latest-mac.yml`. No App Store, no checkout page.
- **Marketing copy:** Site says "Free to try — your information stays on the device you choose" ([website/src/App.tsx](/Users/jthiel/projects/everkeep/website/src/App.tsx:168)) and landing hero stresses local-first / no Everkeep cloud ([website/src/App.tsx](/Users/jthiel/projects/everkeep/website/src/App.tsx:78)). Raising price must not contradict this.
- **Vault structure:** 16 NAV_SECTIONS + 3 footer routes ([src/shared/constants/index.ts](/Users/jthiel/projects/everkeep/src/shared/constants/index.ts:12)), section definitions with sensitive fields ([src/shared/sections/definitions.ts](/Users/jthiel/projects/everkeep/src/shared/sections/definitions.ts:1)), attachments, people, accounts, export report + backup archive ([src/main/services/ExportService.ts](/Users/jthiel/projects/everkeep/src/main/services/ExportService.ts:1), [src/renderer/pages/ExportPage.tsx](/Users/jthiel/projects/everkeep/src/renderer/pages/ExportPage.tsx:1)). Review page surfaces stale (>1yr) items ([src/renderer/pages/ReviewPage.tsx](/Users/jthiel/projects/everkeep/src/renderer/pages/ReviewPage.tsx:1)). These are the natural value seams to gate.
- **User journey:** Welcome → Create Vault / Open Vault → Dashboard → 16 section editors → Review → Export/Backup ([src/renderer/pages/WelcomePage.tsx](/Users/jthiel/projects/everkeep/src/renderer/pages/WelcomePage.tsx), [src/renderer/pages/CreateVaultPage.tsx](/Users/jthiel/projects/everkeep/src/renderer/pages/CreateVaultPage.tsx)). Settings currently handles vault password + app updates ([src/renderer/pages/SettingsPage.tsx](/Users/jthiel/projects/everkeep/src/renderer/pages/SettingsPage.tsx:1)) — natural home for License.
- **Stage:** Pre-1.0, no paying users yet. Git history is all feature scaffolding (`feat: everkeep vault encryption`, `feat: add actionable home checklist`, etc.). No installed base to grandfather.
- **External constraint:** No ongoing cloud costs (vaults are local SQLite). Subscription must therefore sell *ongoing value* (updates, support, family sharing), not usage.

## Constraints And Non-goals
- **Must preserve local-first trust:** No mandatory cloud account to open an existing vault; no phoning home on every launch; offline grace must be generous (30+ days).
- **Must not ransom data:** Free tier hitting a limit must leave vault readable and exportable (at least with watermark/friction), not bricked. Time-bomb trial that locks the vault is out.
- **Must not require a billing backend team:** Use a Merchant of Record (Paddle or Lemon Squeezy) that handles VAT/tax, invoicing, and license-key issuance so Everkeep never touches card data.
- **Must work cross-platform installer:** Licensing survives DMG/EXE installs and `Save As`/`Backup` moves ([src/main/services/VaultService.ts](/Users/jthiel/projects/everkeep/src/main/services/VaultService.ts:1)).
- **Non-goals for this plan:** App Store deployment, subscription with metered AI credits (no AI in app), enterprise SSO, or rebuilding the marketing site beyond a Buy/License page.

## Key Decisions

### 1) When to charge: stay free during 0.1.x, monetize at 1.0
- **Recommended:** Keep `0.1.x` completely free (no gating) to maximize installer testing, feedback, and reviews. Instrument only (count vaults/entries locally, no telemetry). Ship monetization code behind a feature flag, disabled. Flip at `1.0.0` public launch that is marketed as "Everkeep 1.0" with release notes + website pricing.
- **Rejected: monetize now at 0.1.0.** Too early — installer pipeline is still stabilizing (Windows x64 caveat in [README.md](/Users/jthiel/projects/everkeep/README.md:25)), and paywalling a 0.1 product signals false maturity.
- **Rejected: wait until 5k+ users.** Leaves money and signal on the table; early buyers are your best champions.

### 2) Model: generous freemium capped by data completeness + export quality, paid is one-time lifetime with 1 year of updates (not monthly subscription)
- **Recommended:** 
  - **Free:** unlimited vaults, unlimited People, up to ~25–30 entries total across all sections + up to 5 attachments + Export creates a watermarked HTML report (banner + sensitive fields redacted unless checked) and Backup works but shows "Free version" naming. Enough to finish 2–3 sections end-to-end and *feel* the value.
  - **Paid (Everkeep Lifetime — $59–$79 single payment):** unlimited entries/attachments, clean export without watermark, priority support, and all app updates for 12 months. After 12 months, app keeps working forever on owned version; buying a major update (e.g., 2.0) is discounted 40–50%. Offer a Family variant (+$20) licensed for up to 5 household devices (same Ed25519 license, `seats` claim).
  - **No recurring monthly charge at v1.** Optionally add annual "Everkeep Care" ($29/yr) later as voluntary renew for continued updates — not required to keep vault open.
- **Why not pure subscription ($5–9/mo):** Everkeep has no ongoing costs to justify rent and is used episodically (set up then revisit annually in [ReviewPage](/Users/jthiel/projects/everkeep/src/renderer/pages/ReviewPage.tsx)). Subscription would spike churn and feel punitive for an estate file people want to *own*. Evidence: productivity tools with finite value convert poorly to subscriptions; 1Password-style rent works because it syncs daily — Everkeep does not. The "freemium subscription" success cases (Spotify, Notion, Canva) rely on ongoing evolving value with network/storage costs.
- **Why not pure one-time with no free tier:** You lose the "try before you trust someone with your estate data" funnel. Estate category requires trial confidence.
- **Why not 14-day time trial:** Local vault + time bomb = fear of lockout. User interviews for estate tools consistently prefer feature caps over time caps. Feature cap also keeps the vault readable after trial ends; time trial that turns the app read-only after expiry risks I-need-my-will-tomorrow panic.
- **Alternative kept as fallback:** If conversion <3% after 8 weeks, test a 30-day full-feature trial that gracefully degrades to the free cap (never locks vault) rather than to read-only.

### 3) Price anchor
- **Recommended:** $59 introductory / $79 regular for Lifetime Single Household. Family $79/$99. Benchmark: competing estate vaults charge $99/yr (Everplans) or $50–150 one-time (desktop competitors reviewed in search). At 0.1.0 scarcity, start at $59 to de-risk initial conversion, raise to $79 after 100 paid licenses + testimonials.
- Prices are one-time via MoR checkout; no in-app price fetching needed (reduces attack surface).

### 4) Merchant of Record and license mechanism
- **Recommended:** **Lemon Squeezy** first, **Paddle** as named fallback.
  - Reasons: Lemon Squeezy has built-in license-key API, simplest solo-dev path, no domain approval delay; Paddle is the Mac-indie historical default with thicker compliance but slower onboarding (domain approval 7+ days blocked prior case). Both act as MoR (collect VAT globally, you never touch card data) and both can issue signed offline licenses.
  - Rejected: Stripe Billing directly (you become seller of record — you own tax), Gumroad (weaker licensing, not MoR for VAT), self-rolled server (tax liability + fraud).
- **License format:** Ed25519-signed JWT/license file (e.g., `license.ekey`). 32-byte public key embedded in Electron main binary, 64-byte signature — offline verify in <5ms, no network required. Payload: `email, product, seats, issuedAt, validUntil (entitlement), trial`, signed by MoR webhook server (tiny Cloudflare Worker or Vercel function) that mints the license on `order_created` / `subscription_created` webhook. App validates signature offline; only contacts the (optional) validation endpoint for revocation/updates when online, with 45-day grace if offline. This matches the Ed25519 JWT pattern surfaced in discovery and avoids RS256 bloat.
- **Gumroad-license-lite pattern** is acceptable but weaker MoR: if you ever pivot to Gumroad, verify via `gumroad-license-lite`-style API, but MoR via Lemon Squeezy/Paddle remains preferred for estate buyers who want invoices.
- **No license server DB to operate at v1:** use the MoR dashboard as source of truth; webhook worker only signs. Store license at `userData/license.ekey` + optional `license.ekey` next to vault for family share.

### 5) Gating surface (where freemium bites)
- **Gate at creation, not at reading:** When free user tries to create the (N+1)th entry beyond cap, or 6th attachment, or clean export — show a paywall sheet explaining the cap and offering Buy / Enter License / Continue with watermark.
- **Never gate:** opening an existing vault (even paid vault on free install), reading/searching, Review/Still accurate, Settings password, or app updates. Downgrading from paid to free never deletes data — vault stays readable, further creates are blocked.
- **Telemetry-free enforcement:** all counting is local (`SELECT COUNT(*) FROM vault_entries WHERE archived_at IS NULL`) + in-memory check before `EntryRepository.create`. No server ping to count.

### 6) Purchase & activation UX
- Website has `/pricing` + `/buy` that links to MoR hosted checkout (no card fields on everkeep.com) → on success, MoR emails license file + shows "Copy key" page → user pastes key/file in App Settings → License. Also offer "Activate from file" (drag `license.ekey`).
- Trial: no email required; app is free-capped from first launch. Optional 14-day *full-feature* trial is unlocked by entering email at Settings (gets a time-limited signed trial license via MoR trial product for free — no card).
- Errors handled locally: invalid signature → "That file doesn't match Everkeep's publisher key" — never expose raw crypto errors.

## Recommended Approach
Phase the work so you can ship 1.0 without splitting attention from vault stability:

**Phase 0 (now – 0.1.x, no gating):** Add pricing copy behind flag (website `/pricing` draft, Settings "License" stub hidden), pick MoR (apply to Lemon Squeezy, get webhook signing secret), design caps + paywall copy, and add `license.ekey` path constant. No enforcement.

**Phase 1 (license plumbing, flag off):** Add `LicenseService` in `src/main/services/`, `license` table in SQLite for per-vault vs per-install decisions (or just file on disk — prefer file so reinstall survives), IPC `license:*` channels, preload `window.everkeep.license`, and Settings License page. Implement Ed25519 offline verify + 45-day offline grace + trial mint. Webhook worker (15 lines) that verifies MoR HMAC, mints signed license, and emails/delivers it. Test with MoR sandbox keys.

**Phase 2 (gating, flag on at 1.0):** Enforce caps in `VaultService`/`EntryRepository`/`AttachmentService`/`ExportService`, watermark free exports, add paywall sheets on all `NAV_SECTIONS`. Update website deploy to publish real checkout URLs and versioned pricing. Ship as `1.0.0` with migration that marks all pre-1.0 installs as `grandfathered: true` (lifetime, no cap) for 60 days — courtesy for early testers.

**Phase 3 (optimize):** A/B entry cap (25 vs 35), Family seats, discount upgrade flow for 2.0, and optional annual Care renew. Only if Phase 2 converts.

## Work Plan

### Milestone A — Decide & design (no code)
- A1. Choose caps numerically (recommend 30 entries / 5 attachments) and draft paywall copy that explicitly promises "your existing vault stays open forever." Owner: PM/founder. Surface: `docs/plans` + `website/src/App.tsx` pricing section draft.
- A2. Apply to Lemon Squeezy (create product: Everkeep Lifetime Single + Family, 0-tax MoR), reserve Paddle as fallback. Record product IDs and webhook secret rotation plan. Owner: founder.
- A3. Define grandfather policy: any vault created before `1.0.0` tag gets `grandfathered` flag in `RecentVaultsStore` / `VaultRepository`. Decide 60-day window and messaging.

### Milestone B — License plumbing (flag disabled, shippable anytime)
- B1. **Main:** `src/main/services/LicenseService.ts` — load/verify `license.ekey` (Ed25519, public key constant), parse claims, compute `entitlement: free | trial(active/expired) | lifetime | family`, enforce offline grace (last successful online check timestamp). Store at `app.getPath('userData')/license.ekey`.
- B2. **IPC + preload:** New `IpcChannels.license.*` (`getStatus`, `activateKey`, `activateFile`, `deactivate`, `checkOnline`), Zod schemas in `src/shared/schemas/license.ts`, expose via [src/preload/index.ts](/Users/jthiel/projects/everkeep/src/preload/index.ts) and typed `src/shared/types/license.ts`.
- B3. **Settings UI:** New License card in [SettingsPage](/Users/jthiel/projects/everkeep/src/renderer/pages/SettingsPage.tsx:1) — status badge (Free / Trial 12 days left / Lifetime ✓), paste key / drop file, Buy button (opens MoR checkout via `shell.openExternal`), offline grace notice, Deactivate.
- B4. **Worker:** Single endpoint `/webhooks/lemonsqueezy` verifying `X-Signature` HMAC, mapping `product_id → tier`, minting Ed25519 JWT with `@noble/hashes` or `jose`, storing issuance log in KV. Deploy to Cloudflare Worker / Vercel. Keep Paddle adapter dormant behind config switch.
- Reuse: `src/main/security/EncryptionService.ts` patterns for key handling, `Result` pattern in [src/main/ipc/result.ts](/Users/jthiel/projects/everkeep/src/main/ipc/result.ts) for IPC errors.

### Milestone C — Freemium enforcement (flag enabled at 1.0)
- C1. **Entry cap:** In `EntryRepository` / `VaultService.createEntry` path ([src/main/repositories/EntryRepository.ts](/Users/jthiel/projects/everkeep/src/main/repositories/EntryRepository.ts), [src/main/services/VaultService.ts](/Users/jthiel/projects/everkeep/src/main/services/VaultService.ts:1)), check `license.entitlement` before insert; if free+trial expired and count ≥ cap, return `FREEMIUM_LIMIT` error that renderer turns into paywall sheet (not a toast).
- C2. **Attachments cap:** Same in `AttachmentService` (allow 5 free, unlimited paid).
- C3. **Export watermark:** In [ExportService](/Users/jthiel/projects/everkeep/src/main/services/ExportService.ts:1), if free, inject banner "Created with Everkeep Free — upgrade to remove watermark and include sensitive fields cleanly" and force `includeSensitive=false` unless paid. Backup remains functional (don't gate safety), but filename hints `…-free. everkeep-backup`.
- C4. **Renderer paywall sheets:** Shared `<PaywallSheet>` component used by all 16 `EntriesSectionPage` editors + `FinancialPage` + `PeoplePage` + `ExportPage`. CTA: Buy / Enter License / Maybe later. Do **not** block Update checks.
- C5. **Grandfather migration:** On first run with new code, if `LicenseService` finds no license but `RecentVaultsStore` has vaults predating `1.0.0` build date, set in-memory `grandfathered=true` (persisted in `userData/config.json`) so those installs bypass caps until 60-day sunset notice.

### Milestone D — Website & launch
- D1. `website/src/pages/Pricing.tsx` + update [downloads.ts](/Users/jthiel/projects/everkeep/website/src/config/downloads.ts:1) to include `VITE_CHECKOUT_URL` envs, add FAQ addressing "Does my vault lock if I don't pay?" (answer: no).
- D2. Release pipeline: add `LICENSE_PUBLIC_KEY` build arg, publish `1.0.0` tag after `npm run typecheck && npm test && npm run build`, attach `latest.yml` as today, and publish pricing blog post.
- D3. Support playbook: license reissue flow (MoR dashboard → resend), refund handling via MoR (license revocation list checked opportunistically, not hard-blocking offline).

## Validation Plan
- **Unit (no MoR):** `LicenseService` signature verify with known test keypair — valid, expired trial, tampered payload (1-byte flip), offline grace boundary (46 days), leading-zero edge. Run via `vitest run` (existing [vitest.config.ts](/Users/jthiel/projects/everkeep/vitest.config.ts)). Cap checks: creating 30th entry succeeds, 31st returns `FREEMIUM_LIMIT` with free entitlement; same after activating lifetime fixture — 31st succeeds. Export watermark present/absent based on fixture.
- **Integration (sandbox MoR):** Hit MoR test checkout, receive webhook → signed license file → activate in built app → verify paywall lifts, export clean, vault still opens after deactivating network (offline grace). Tampered license file rejected with friendly error.
- **Manual E2E (installed app):** Fresh install → Welcome → Create vault → add 30 entries → 31st shows paywall sheet (not error toast) with Buy/Enter License. Buy in browser → drop `license.ekey` → paywall disappears, can add 100+ entries, export without watermark. Disconnect network for 40 days (clock mock) → still works. Pre-1.0 vault on new build → grandfathered banner, no cap until 60-day notice. Existing vault opened on a free install on another machine → reads perfectly (never blocked).
- **Website:** `npm --prefix website run build` + click Buy → hosted MoR checkout opens (not 404), env URLs resolve. No card fields on everkeep.com.
- **Highest-risk validation:** Offline license trust boundary. Must prove an attacker cannot bypass cap by editing a JSON config — only a valid Ed25519 signature bypasses, and trial expiry is inside signed claims, not a mutable file. Falsify by editing `userData/config.json` trial date and confirming app still enforces signed expiry.

## Risks / Rollback
- **Risk: Paywall kills word-of-mouth growth.** Mitigation: generous cap (30 entries is a real vault, not a demo), watermark is informational not punitive, and grandfathering avoids punishing early testers. Rollback: flip feature flag `FREEMIUM_ENABLED=false` in next patch; no schema change needed.
- **Risk: MoR onboarding delay (Lemon Squeezy payout verification, Wise/Payoneer).** Mitigation: apply now, keep Paddle application parallel, ship B-milestone behind flag so launch isn't blocked.
- **Risk: Anger over "holding estate data hostage."** Mitigation: guarantee in copy and code — free caps only affect *creating* new entries/attachments/clean exports; reading, Review, Search, Save As, and Backup never gate. Document in `/pricing` FAQ and in-app Settings notice.
- **Risk: License key piracy / sharing.** Mitigation: Family seats encoded in signed license; offline grace limits blast radius. Do not add invasive device fingerprinting at v1 — accept low piracy as cost of local-first trust. Revocation list checked opportunistically on update checks, not hard-required.
- **Risk: Tax liability if you roll your own billing.** Mitigation: MoR handles VAT/sales tax globally; you never see card data — buyer receipt comes from MoR.
- **Rollback plan:** If 1.0 conversion is unexpectedly low or backlash is high, ship `1.0.1` with `FREEMIUM_ENABLED=false` and issue refunds via MoR dashboard + revoke future checks (existing signed licenses harmlessly stop being required). No vault migration to undo.

## Open Questions
- **Q1: Exact cap numbers.** Assumption is 30 entries / 5 attachments — confirms after dogfooding one real family vault end-to-end. If a single thorough household needs 22 entries to feel "done," raise cap to 35 before 1.0.
- **Q2: Family seats enforcement.** Should Family be self-declared (honor system) or device-counted via license `seats` claim? Assumption: honor system at v1 with signed `seats:5` — no device phoning home.
- **Q3: App Store later?** Assumption: direct-download only for 1.0; revisiting Mac App Store would force StoreKit licensing and a different paywall (receipt validation).
- **Q4: Price point certainty.** $59/$79 is an assumption pending 10 pricing interviews ("would you pay $X to keep this vault forever with 1 year of updates?"). Keep price configurable via MoR product, no code change required.

## Sources
- [Gumroad license verification pattern for Electron — offline/online pitfalls](https://dev.to/ape_collective_/how-to-verify-gumroad-license-keys-in-an-electron-app-and-the-3-gotchas-nobody-warns-you-about-38gn) — inspected for offline-tolerant validation and HMAC pitfalls; applied to MoR webhook verification design.
- Paddle / Lemon Squeezy Merchant-of-Record comparisons were discovery-indexed but underlying authoritative docs (paddle.com, lemonsqueezy.com/help/licensing) returned empty/404 during this run — MoR recommendation is therefore conditional on re-inspecting Lemon Squeezy's current license-key docs before B4 implementation. Do not mint production licenses until that doc is successfully fetched.

---
Saved to `.agents/plans/2026-09-01-everkeep-monetization.md`
