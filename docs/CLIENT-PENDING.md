# Client Pending — TSE Online

Questions, confirmations, and assets we are waiting on from the client.
Update the status column as items are resolved.

> **Status (2026-07-01):** The platform is **live in production on the apex domain**
> `https://tse-cartridges.co.za` (+ `api.tse-cartridges.co.za`), running side by side with the
> old Woo site on `tse.co.za`. Catalogue (339 products / 559 variants) seeded, PayFast flipped
> to live mode, nightly DB backups to R2 automated. Remaining go-live gates are the client
> items below — chiefly the POPIA Information Officer (#11), Resend domain verification (#10),
> the PayFast dashboard URLs, and a real end-to-end test order.
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

| # | Item | Why it's needed | Status | GitHub issue |
|---|------|-----------------|--------|--------------|
| 1 | **Written confirmation: Inter + Fraunces font pairing** | Required to lock down typography before Milestone 1 components are built. Proposal posted on issue. | ⏳ Awaiting reply | #24 |
| 2 | **Original logo source file** (Illustrator / CorelDraw) | Current `logo.svg` is a 1.3 MB raster trace — not true vector. Needed for favicon, app icons, print assets, and clean SVG export. | ⏳ Awaiting file | #22 |
| 3 | **White / monochrome logo variants** | Needed for dark nav, email headers, and printed materials. Can be generated from source file once supplied. | ⏳ Awaiting source | #22 |
| 4 | **Product photography updates** (post-launch) | Existing WooCommerce library covers the relaunch. Request updated/additional photography from client after go-live. | 🔜 Post-launch | #25 |
| 5 | **Favicon & app icons** | Depends on clean logo source (#2 above). Cannot finalise until vector file is received. | ⏳ Blocked on #2 | #3.5 |
| 6 | **PayFast credentials** | Merchant ID + passphrase required to configure the PayFast Medusa payment plugin. Nothing can go live without this. | 🔄 Received (merchant `10050765`) — provider live (`PAYFAST_SANDBOX=false`) & enabled on the ZAR region. **Remaining:** client to update return/notify/cancel URLs to the apex in the PayFast dashboard, then one real low-value test order (pay → refund) to confirm live capture + ITN. | #5.1 |
| 7 | **Compatibility gaps CSV** (`compat-gaps.csv`) | 91 products have no printer model compatibility data. Client must fill in the model column and return the file before migration can complete. | ⏳ Awaiting return | #20 |
| 8 | **`tse.co.za` → `tse-cartridges.co.za` redirect** (post-launch) | `tse-cartridges.co.za` is the confirmed primary domain. **No hard cutover:** the new site runs side by side with the existing WooCommerce site (`tse.co.za`) — both stay live in parallel after launch. The 301 redirect and WooCommerce decommission happen only later, once the new site is proven in production and the client signs off on retiring the old one. DNS and nginx 301 redirect config to be set up at that time. | 🔄 **Redirect map done** (832/832 URLs, inert on the box — `PROD-DEPLOY.md` §7a). Awaiting client sign-off to decommission Woo, and resolution of #13. | — |
| 9 | **Vultr VM provisioning** | We need SSH access to the Johannesburg VM to complete the deployment chain (#4.2–#4.10). Nothing goes live without this. | ✅ Done — VM `tse-prod-jnb` (`139.84.247.189`) live, full stack deployed on the apex domain, GitHub Actions deploy working. | #4.1 |
| 10 | **Resend sending domain (`sales@tse.co.za`)** | Transactional email — order confirmations, password resets, B2B/quote/data-request notifications. | 🔄 API key set in prod; `RESEND_FROM_EMAIL=sales@tse.co.za` (send from the legacy store domain — a real monitored inbox behind the `exmail.work` MX). **Remaining:** (a) add `tse.co.za` as a domain in the Resend dashboard and publish its DKIM (`resend._domainkey`) + SPF/MX (`send.tse.co.za`) records in **GAM DNS** — subdomain-scoped, leaves the existing inbound/SPF/DMARC untouched; (b) rotate the exposed key. | #5.4 |
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

---

> Keep this file updated. When a pending item is resolved, move it to the Resolved table with the date and a brief note. Reference the GitHub issue number so context is traceable.
