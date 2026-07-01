# Client Pending — TSE Online

Questions, confirmations, and assets we are waiting on from the client.
Update the status column as items are resolved.

> **Status (2026-07-01):** The platform is **live in production on the apex domain**
> `https://tse-cartridges.co.za` (+ `api.tse-cartridges.co.za`), running side by side with the
> old Woo site on `tse.co.za`. Catalogue (339 products / 559 variants) seeded, PayFast flipped
> to live mode, nightly DB backups to R2 automated. Remaining go-live gates are the client
> items below — chiefly the POPIA Information Officer (#11), Resend domain verification (#10),
> the PayFast dashboard URLs, and a real end-to-end test order.

| # | Item | Why it's needed | Status | GitHub issue |
|---|------|-----------------|--------|--------------|
| 1 | **Written confirmation: Inter + Fraunces font pairing** | Required to lock down typography before Milestone 1 components are built. Proposal posted on issue. | ⏳ Awaiting reply | #24 |
| 2 | **Original logo source file** (Illustrator / CorelDraw) | Current `logo.svg` is a 1.3 MB raster trace — not true vector. Needed for favicon, app icons, print assets, and clean SVG export. | ⏳ Awaiting file | #22 |
| 3 | **White / monochrome logo variants** | Needed for dark nav, email headers, and printed materials. Can be generated from source file once supplied. | ⏳ Awaiting source | #22 |
| 4 | **Product photography updates** (post-launch) | Existing WooCommerce library covers the relaunch. Request updated/additional photography from client after go-live. | 🔜 Post-launch | #25 |
| 5 | **Favicon & app icons** | Depends on clean logo source (#2 above). Cannot finalise until vector file is received. | ⏳ Blocked on #2 | #3.5 |
| 6 | **PayFast credentials** | Merchant ID + passphrase required to configure the PayFast Medusa payment plugin. Nothing can go live without this. | 🔄 Received (merchant `10050765`) — provider live (`PAYFAST_SANDBOX=false`) & enabled on the ZAR region. **Remaining:** client to update return/notify/cancel URLs to the apex in the PayFast dashboard, then one real low-value test order (pay → refund) to confirm live capture + ITN. | #5.1 |
| 7 | **Compatibility gaps CSV** (`compat-gaps.csv`) | 91 products have no printer model compatibility data. Client must fill in the model column and return the file before migration can complete. | ⏳ Awaiting return | #20 |
| 8 | **`tse.co.za` → `tse-cartridges.co.za` redirect** (post-launch) | `tse-cartridges.co.za` is the confirmed primary domain. **No hard cutover:** the new site runs side by side with the existing WooCommerce site (`tse.co.za`) — both stay live in parallel after launch. The 301 redirect and WooCommerce decommission happen only later, once the new site is proven in production and the client signs off on retiring the old one. DNS and nginx 301 redirect config to be set up at that time. | 🔜 Post-decommission | — |
| 9 | **Vultr VM provisioning** | We need SSH access to the Johannesburg VM to complete the deployment chain (#4.2–#4.10). Nothing goes live without this. | ✅ Done — VM `tse-prod-jnb` (`139.84.247.189`) live, full stack deployed on the apex domain, GitHub Actions deploy working. | #4.1 |
| 10 | **Resend API key + sending domain** | Required for transactional email (order confirmations, password resets). Domain DNS records will need to be updated. | 🔄 API key set in prod (`orders@tse-cartridges.co.za`). **Remaining:** verify DKIM/SPF on `tse-cartridges.co.za` in the Resend dashboard, and rotate the key (it was exposed in a terminal). | #5.4 |
| 11 | **Information Officer designated + registered** | POPIA hard go-live gate. The Information Officer defaults to TSE's MD (responsible party). Client must formally designate the person (plus any Deputies) and register them with the Information Regulator via the online portal. TriNext is an operator, not the responsible party — we cannot supply this. | ⏳ Awaiting client | #12 |

---

## Resolved

| # | Item | Resolved | Notes |
|---|------|----------|-------|
| R1 | **POPIA consent — customer & order data export** | 2026-05-15 | Written confirmation received. `customers.json` and `orders.json` remain gitignored, SA infrastructure only. |
| R2 | **Brand colour hex codes** | 2026-05-15 | Primary `#dfe344` (lime), Secondary `#41e0f5` (cyan), Accent `#ee75e9` (pink). Confirmed via issue #23. |
| R3 | **Product photography for launch** | 2026-05-15 | Existing WooCommerce image library is sufficient for relaunch. Photo updates deferred to post-launch. See issue #25. |
| R4 | **Brand guidelines document** | 2026-05-15 | Client had none. Created `docs/brand.md` from confirmed assets (colours, logo, voice, typography). See issue #27. |

---

> Keep this file updated. When a pending item is resolved, move it to the Resolved table with the date and a brief note. Reference the GitHub issue number so context is traceable.
