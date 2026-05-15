# Client Pending — TSE Online

Questions, confirmations, and assets we are waiting on from the client.
Update the status column as items are resolved.

| # | Item | Why it's needed | Status | GitHub issue |
|---|------|-----------------|--------|--------------|
| 1 | **Written confirmation: Inter + Fraunces font pairing** | Required to lock down typography before Milestone 1 components are built. Proposal posted on issue. | ⏳ Awaiting reply | #24 |
| 2 | **Original logo source file** (Illustrator / CorelDraw) | Current `logo.svg` is a 1.3 MB raster trace — not true vector. Needed for favicon, app icons, print assets, and clean SVG export. | ⏳ Awaiting file | #22 |
| 3 | **White / monochrome logo variants** | Needed for dark nav, email headers, and printed materials. Can be generated from source file once supplied. | ⏳ Awaiting source | #22 |
| 4 | **Product photography** | Hero and product card images. Placeholder gradients used in storefront until supplied. | ⏳ Awaiting assets | #3.4 |
| 5 | **Favicon & app icons** | Depends on clean logo source (#2 above). Cannot finalise until vector file is received. | ⏳ Blocked on #2 | #3.5 |
| 6 | **PayFast credentials** | Merchant ID + passphrase required to configure the PayFast Medusa payment plugin. Nothing can go live without this. | ⏳ Awaiting credentials | #5.1 |
| 7 | **Compatibility gaps CSV** (`compat-gaps.csv`) | 91 products have no printer model compatibility data. Client must fill in the model column and return the file before migration can complete. | ⏳ Awaiting return | #20 |
| 8 | **Vultr VM provisioning** | We need SSH access to the Johannesburg VM to complete the deployment chain (#4.2–#4.10). Nothing goes live without this. | ⏳ Awaiting VM | #4.1 |
| 9 | **Resend API key + sending domain** | Required for transactional email (order confirmations, password resets). Domain DNS records will need to be updated. | ⏳ Awaiting setup | #5.4 |

---

## Resolved

| # | Item | Resolved | Notes |
|---|------|----------|-------|
| R1 | **POPIA consent — customer & order data export** | 2026-05-15 | Written confirmation received. `customers.json` and `orders.json` remain gitignored, SA infrastructure only. |
| R2 | **Brand colour hex codes** | 2026-05-15 | Primary `#dfe344` (lime), Secondary `#41e0f5` (cyan), Accent `#ee75e9` (pink). Confirmed via issue #23. |

---

> Keep this file updated. When a pending item is resolved, move it to the Resolved table with the date and a brief note. Reference the GitHub issue number so context is traceable.
