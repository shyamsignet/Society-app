# Going live with your society – Sociyo

The app is published at **https://shyamsignet.github.io/Society-app/**.

Out of the box the app runs as an **offline demo** (sample society, data kept on
each phone). To use it for a real society, connect it to a free **Supabase**
project. Then everyone shares the same data, logs in with their own mobile
number, and the database itself enforces who can see and change what.

Everything below can be done from a phone browser. Plan for about an hour.

---

## 1. Create the Supabase project (10 min)

1. Go to **supabase.com** → sign up with the **society's email** (not a personal one).
2. **New project** → name it (e.g. `shanti-nagar-society`) → set a strong database
   password and save it somewhere safe → **Region: South Asia (Mumbai)** → Create.
3. Wait ~2 minutes for it to start.

## 2. Create the database (2 min)

1. In Supabase open **SQL Editor** → **New query**.
2. Open [`supabase/setup.sql`](../supabase/setup.sql) in this repository, copy **all** of it,
   paste it into the editor and press **Run**. You should see "Success. No rows returned".
   (It is safe to run again later when the app is updated.)

This creates the tables, the security rules, the photo storage bucket and the
live-update feed.

## 3. Turn on login (10–30 min)

Open **Authentication → Sign In / Providers** (menu names may differ slightly).

**Email codes – free, works immediately**
1. Email is enabled by default.
2. Go to **Authentication → Emails → Templates → Magic Link** and make sure the
   message contains `{{ .Token }}` — e.g. *"Your Sociyo login code is {{ .Token }}"*.
   The app asks for this 6-digit code.
3. Supabase's built-in email sender only allows a few emails per hour. For a real
   society, add your own SMTP sender under **Authentication → Emails → SMTP settings**
   (Brevo, Resend, Zoho, Gmail Workspace… most have a free tier).

**SMS codes – what most residents expect**
1. **Phone** provider → Enable → pick an SMS provider (Twilio, Twilio Verify,
   MessageBird, Vonage or Textlocal) and paste its keys.
2. SMS to Indian numbers requires **DLT registration** (TRAI rules) of the sender
   ID and message template; your SMS provider will guide you. Cost is roughly
   ₹0.20–0.30 per login code.
3. Until SMS is ready, residents can use the **Email** tab on the login screen.

**URL Configuration** → set **Site URL** to your app address, e.g.
`https://shyamsignet.github.io/Society-app/`.

## 4. Connect the app (5 min)

1. Supabase → **Project Settings → API** → copy the **Project URL** and the
   **anon public** key. (The anon key is meant to be public; the security rules
   protect the data. Never share the *service_role* key.)
2. GitHub → this repository → **Settings → Secrets and variables → Actions →
   Variables** tab → **New repository variable**, add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_ANON_KEY` | the anon public key |
   | `SOCIETY_NAME` | *(optional)* shown on the login screen |
   | `SOCIETY_CODE` | *(optional, add after step 5)* pre-fills "Join my society" |

3. **Actions** tab → *Test & deploy to GitHub Pages* → **Run workflow**. After
   ~2 minutes the app at https://shyamsignet.github.io/Society-app/ is in society mode (the demo
   accounts disappear).

## 5. Set up the society in the app (15 min)

1. Open the app → log in with **your** mobile number (or email).
2. Choose **Set up a new society** and follow the 4 steps: society details,
   towers & flats, you, maintenance & amenities. You become the **Super Admin**.
3. You land on **Import from spreadsheet**:
   - Tap **Template**, fill it in Excel / Google Sheets
     (`flat, name, mobile, email, owner_tenant, role, opening_balance`),
     save as **CSV**, then **Choose CSV file**.
   - Rows with problems are shown in red and skipped; fix and re-import any time.
   - Put committee roles in the `role` column (`chairman`, `secretary`,
     `treasurer`, `committee`, `facility_manager`, `security`), or change roles
     later in **Admin → Residents & apartments → People**.
   - `opening_balance` carries each flat's current dues into the app.
   - If flat numbers/sizes are irregular, use the **Flats** tab first.
4. **Admin → Maintenance billing → Charges**: check the rates and add the
   society's **UPI ID** and bank details – this is how residents pay.
5. **Admin → Staff & contacts**: add plumber, electrician, housekeeping, etc.
   (used for complaint assignment) and any extra emergency numbers.
6. **Admin → Facilities & bookings → Facilities**: adjust timings, charges and rules.

Residents in the spreadsheet can now simply log in with their mobile number –
no invitations needed. Anyone not in the list can tap **Join my society**, enter
the society code, choose their flat, and the committee approves them under
**Admin → Residents & apartments → Requests**.

## 6. How money works

- Bills are generated each month from **Admin → Maintenance billing → Generate bills**.
- Residents tap **Pay** → **Pay with UPI app** (GPay/PhonePe opens with the
  society's UPI ID and the amount) → pay → enter the 12-digit UTR → **I have paid**.
- The treasurer sees it under **Payments to verify**, checks the bank statement,
  and taps **Money received**. Only then is the bill marked paid and a receipt
  issued. Cash/cheque at the office: open the flat's bill → **Record offline payment**.
- Residents can never mark their own bill paid – the database refuses it.
- A payment gateway (Razorpay/Cashfree) can be added later for automatic confirmation.

## 7. Before launch – checklist

- [ ] Treasurer has checked every flat's opening balance against the old register
- [ ] Committee roles assigned; each committee member has logged in once
- [ ] Security guard logged in on the gate phone (role `security`)
- [ ] Test with 10–15 flats for two weeks (see the README's next steps)
- [ ] Flyer ([`docs/flyer/`](flyer/)) filled in with the society name, **society code** and office phone, then printed / shared on WhatsApp

## What the security rules guarantee

These are tested automatically on every update (`npm run test:db`, 70 checks):

- Only members of the society can read anything; tables cannot be read directly.
- Residents see only their **own** bills, payments, complaints, visitors and notifications.
- Phone numbers / emails / family details of others are hidden unless that person
  chose to show them (committee, office and security can see contact numbers).
  Vehicles and emergency contacts of others are never sent.
- Nobody can edit someone else's profile, post, or comment, like or vote on
  someone else's behalf, or vote twice for the same flat.
- Only the committee can publish notices or polls; only treasurer/chairman/super admin
  can create bills or mark them paid; only security can check visitors in/out.
- Double booking of a facility is impossible (checked inside the database).
- Deactivating a person locks them out immediately.

## Good to know

- **Backups:** check what your Supabase plan includes. On the free plan, download
  a copy regularly (Supabase → Database → Backups, or Table editor → export), or
  upgrade to a paid plan for automatic daily backups.
- **Free plan pausing:** Supabase pauses free projects after a period of no use;
  a society using the app daily will not hit this.
- **Live updates:** phones get changes within seconds via Supabase Realtime, and
  also catch up every 30 seconds and whenever the app is opened.
- **Two people editing the same thing at the same second** (e.g. both commenting
  on one post at once): the later change can overwrite the earlier one. This is
  rare in practice; the app re-syncs within seconds so it is visible.
- **Downloaded PDF receipts** are in English.
