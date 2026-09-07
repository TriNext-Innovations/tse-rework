# Client Pending — TSE Online

Questions, confirmations, and assets we are waiting on from the client.
Update the status column as items are resolved.

> **Status (2026-07-01):** The platform is **live in production on the apex domain**
> `https://tse-cartridges.co.za` (+ `api.tse-cartridges.co.za`), running side by side with the
> old Woo site on `tse.co.za`. Catalogue (339 products / 559 variants) seeded, PayFast flipped
> to live mode, nightly DB backups to R2 automated. Remaining go-live gates are the client
> items below. (That list originally named the POPIA Information Officer, Resend domain
> verification and a live test order — all since done or superseded; see Resolved.)
>
> **Update (2026-09-06):** The legacy cutover redirect map is **built and deployed inert** —
> 832/832 indexed `tse.co.za` URLs mapped, regenerated from live sources, drift-tested
> (see `docs/PROD-DEPLOY.md` §7a). Two client decisions now gate the cutover: the **primary
> domain direction** (#13) and the **Samsung/Lexmark inkjet** stock call (#12).
> Separately, a review of WooCommerce sales data shows **online revenue down 59% year-on-year**
> — see `docs/COMMERCIAL-FINDINGS.md`. This warrants a client conversation, not just a status mail.
>
> **Client contact log:** Status + decisions email sent to the client **2026-09-06**, covering the
> cutover readiness, decisions #12 and #13, the revenue trend, and the outstanding items below.
> A review meeting is to be scheduled. Meeting deck: `docs/client-meeting-2026-09.html`
> (published, private: https://claude.ai/code/artifact/d9242234-9ed3-4625-83a7-922c14f06798).
>
> **Reconciliation (2026-09-07):** every row was checked against closed issues and live
> evidence rather than against its own status text. **Seven of twelve were wrong** — four
> items the client had already delivered were still listed as owed, and row 10 named the
> wrong email provider entirely. Two of those errors reached the client deck before being
> caught. Rows now carry the evidence that was used to verify them; check the evidence, not
> the emoji, before quoting this file into anything client-facing.

| # | Item | Why it's needed | Status | GitHub issue |
|---|------|-----------------|--------|--------------|
| 2 | **Original logo source file** (Illustrator / CorelDraw) | Print artwork and any future re-draw. **No longer blocking anything digital:** `logo-v2.svg` / `logo-v2-dark.svg` are true vector (2 paths, no embedded raster), live via `Logo.tsx`, and the icon set is complete. | ⏳ Awaiting file — low priority | #22 |
| 4 | **Product photography updates** | The WooCommerce library carried the relaunch. This was deferred *until after go-live* — the site has been live since 2026-07-01, so it is now due rather than pending. | 🔜 Now actionable | #25 |
| 6 | **PayFast dashboard URLs** | Merchant `10050765`, provider live (`PAYFAST_SANDBOX=false`) on the ZAR region. The **live test order is done** (#192: pay → capture → ITN → refund, verified). **Remaining:** return/notify/cancel URLs still point at the old address — deferred post-go-live per Ryno 2026-07-11, since the app passes explicit URLs per payment and the dashboard values are fallback only. | 🔄 Deferred, not blocking | #5.1 |
| 8 | **`tse.co.za` → `tse-cartridges.co.za` redirect** (post-launch) | `tse-cartridges.co.za` is the confirmed primary domain. **No hard cutover:** the new site runs side by side with the existing WooCommerce site (`tse.co.za`) — both stay live in parallel after launch. The 301 redirect and WooCommerce decommission happen only later, once the new site is proven in production and the client signs off on retiring the old one. DNS and nginx 301 redirect config to be set up at that time. | 🔄 **Redirect map done** (832/832 URLs, inert on the box — `PROD-DEPLOY.md` §7a). Awaiting client sign-off to decommission Woo, and resolution of #13. | — |
| 9 | **Vultr VM provisioning** | We need SSH access to the Johannesburg VM to complete the deployment chain (#4.2–#4.10). Nothing goes live without this. | ✅ Done — VM `tse-prod-jnb` (`139.84.247.189`) live, full stack deployed on the apex domain, GitHub Actions deploy working. | #4.1 |
| 10 | **Transactional email — sender DNS** | Order confirmations, password resets, quote/data-request notifications. | 🔄 **ZeptoMail is the live sender** (`ZEPTOMAIL_TOKEN`; #192 — domain verified, test send delivered 2026-07-11, From `orders@tse-cartridges.co.za`, Reply-To `sales@tse.co.za`). Resend is **not** in use; the previous entry here described a Resend/`tse.co.za` setup that was never adopted. **To verify:** `tse-cartridges.co.za` publishes `v=spf1 include:_spf.mx.cloudflare.net ~all` with no ZeptoMail include, no DKIM answered on 12 common selectors, and DMARC `p=quarantine` — ZeptoMail allows custom selectors so this is not proof of a gap, but confirm in the dashboard. **Not a client task while we stay on `tse-cartridges.co.za`** (Cloudflare NS, TriNext-controlled); it becomes one only under #13. | #5.4 |
| 12 | **Samsung / Lexmark inkjet — still stocked?** | The new catalogue has no Samsung or Lexmark *inkjet* category, so those legacy URLs currently 301 to each brand's **laser** page. Sales data supports this (inkjet = 4% of revenue; neither brand appears in the top 25 sellers), but if TSE is importing that stock again the redirects and catalogue must change. | ⏳ Awaiting client | — |
| 13 | **Primary domain direction — confirm** | Item #8 records `tse-cartridges.co.za` as the *confirmed primary domain*, with `tse.co.za` redirecting to it. TriNext has since raised moving the **new site onto `tse.co.za`** instead — it carries the brand recognition, the 1997 registration, and the existing link equity, while `tse-cartridges.co.za` is new and hyphenated. The redirect map works either way (only the target host changes), but this must be settled **before** cutover: it is one-shot for SEO and drives the Search Console change-of-address. | ⏳ Awaiting client decision | — |


---

## Resolved

| # | Item | Resolved | Notes |
|---|------|----------|-------|
| R1 | **POPIA consent — customer & order data export** | 2026-05-15 | Written confirmation received. `customers.json` and `orders.json` remain gitignored, SA infrastructure only. |
| R2 | **Brand colour hex codes** | 2026-05-15 | Primary `#dfe344` (lime), Secondary `#41e0f5` (cyan), Accent `#ee75e9` (pink). Confirmed via issue #23. |
| R3 | **Product photography for launch** | 2026-05-15 | Existing WooCommerce image library is sufficient for relaunch. Photo updates deferred to post-launch. See issue #25. |
| R4 | **Brand guidelines document** | 2026-05-15 | Client had none. Created `docs/brand.md` from confirmed assets (colours, logo, voice, typography). See issue #27. |
| R5 | **Information Officer designated + registered** | 2026-07-11 | **Leon van der Watt**, Information Regulator reg **2026-061608**. Published on `/legal/privacy` (PR #218) and verified live. Certificate in WorkDrive `Client/TSE/IO_Certificate_2026-061608.pdf`. Row 11 sat on "⏳ Awaiting client" for two months after it was done, and the September client deck inherited that error — asked the client to deliver something already delivered. |
| R6 | **Inter + Fraunces typography** | 2026-05-26 | Issue #24 closed; both faces shipped in `layout.tsx` and live on the storefront for four months. The issue's last comment still read "awaiting written confirmation" — overtaken by events, since the client has since reviewed the live site (#192). |
| R7 | **White / monochrome logo variant** | — | `logo-v2-dark.svg` exists, is true vector, and is served by `Logo.tsx` as the dark-nav variant. |
| R8 | **Favicon & app icons** | — | `icon.png`, `icon-512.png`, `apple-icon.png` and `opengraph-image.tsx` all present. Was recorded as "blocked on #2" but never actually was — `logo-v2.svg` supplied the vector. |
| R9 | **Compatibility gaps CSV** | 2026-07-09 | **Returned by the client and imported.** `Copy of compat-gaps.xlsx` in WorkDrive `Client/TSE/` has 89 of 91 model rows filled. Verified live end-to-end: `/printers/hp-officejet-6951` lists **HP 903 XL**, exactly the mapping from the sheet. Sat on "⏳ Awaiting return" for two months after the client had already done it. |

---

> Keep this file updated. When a pending item is resolved, move it to the Resolved table with the date and a brief note. Reference the GitHub issue number so context is traceable.
