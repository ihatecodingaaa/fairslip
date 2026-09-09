# What FairSlip deliberately did not build, and why

Three of the strongest lines available in the pitch are admissions. This file
exists so they are said accurately rather than half-remembered on stage.

Every entry below is a thing that was considered, researched, and dropped on
purpose. None of them was dropped because it was hard. Each says what would be
needed to do it properly, so "roadmap" here means a route someone could actually
walk, not a word for a feature that does not exist.

Verified 9 September 2026 unless stated otherwise. Where a claim could not be
verified it says so.

---

## 1. "Open with FairSlip" from the phone's share sheet

**Not built. It cannot work on iPhone, and roughly half the room is on one.**

The web feature that would do this is the Web Share Target API: an *installed*
PWA registers itself through the `share_target` member of its manifest and
appears in the OS share sheet, receiving files as `multipart/form-data`.

- Spec and behaviour: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
- MDN classifies it as **"Limited availability … not Baseline because it does not
  work in some of the most widely-used browsers."**

**WebKit has never shipped it.** The tracking bug, "Add support for Web Share
Target API", is still **NEW and unassigned**:
https://bugs.webkit.org/show_bug.cgi?id=194593

So on iOS and iPadOS there is no way to register a web app as a share target at
all. On Android it works, but only for a PWA the user has already installed -
the browser registers the target with the OS at install time, not at first
visit.

**Why that is disqualifying rather than merely partial.** StatCounter put iOS at
**45.68%** of Singapore's mobile OS market against Android's 54.28% in June 2026.
A feature demonstrated live that silently does nothing for nearly half the
audience is worse than one that is not there - and the worker persona this
product is built around is not reliably on either platform.

**Do not confuse it with its outbound cousin.** The Web Share API
(`navigator.share()`, sending content OUT) *is* supported on iOS Safari and
Android Chrome. Sharing out works everywhere; being a share target does not.

**What ships instead:** a file picker with `accept="image/*,application/pdf"`
and `capture`, which opens the camera or the photo library directly and works on
every phone browser including iOS Safari. That is already in the product.

**What it would take:** a native wrapper with a Share Extension on iOS. That is
an App Store submission, not an afternoon.

---

## 2. A WhatsApp entry point

**Not built. The approval cannot complete before the pitch, and promising it
live would be promising something nobody has seen work.**

The WhatsApp Business Platform requires a Meta Business Manager account with
**Business Verification**, a dedicated phone number not already active on a
personal or Business-app WhatsApp, display-name approval, and message-template
approval before any business-initiated message can be sent.
https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/

Reported onboarding times, from a 2026 setup guide's dataset of 217 submissions:
**median 4 business days** to approval, the slowest 10% over 14 days, 73%
first-pass approval. Their stated single biggest cause of delay is a legal
business name that does not match the uploaded documents.
https://www.go4whatsup.com/guides/get-whatsapp-business-api/

*Treat those figures as a vendor's own reporting, not an independent audit - but
the direction is not in doubt, and Meta's own documentation confirms that
verification and template review gate sending.*

**Why it matters that this is the RIGHT channel.** It is not a second choice.
See section 3.

**What it would take:** a registered legal entity whose name matches the
submitted documents, then roughly a week of Meta review. Not a code problem.

---

## 3. A Telegram bot instead

**Buildable in an afternoon. Not built, on purpose.**

Telegram's Bot API would work: a bot receives `message.photo` or
`message.document`, calls `getFile`, and downloads the file (bots may download
up to 20 MB, which a payslip photo is comfortably under).
https://core.telegram.org/bots/api

**It was rejected because it would misrepresent itself as a product decision.**
Singapore migrant workers use WhatsApp. MOM's own survey of foreign workers
records communication over "FB, Whatsapp, IMO, Viber", a preference for **voice**
notes over typing, and that Indian workers type Tamil-in-English while
Bangladeshi workers use Bengali:
https://www.mom.gov.sg/~/media/mom/documents/foreign-manpower/findings-from-survey-with-foreign-workers.pdf

Across Singapore generally, WhatsApp is the most-used messaging platform at
around **80%** monthly reach among internet users; Telegram sits at **49.2%**
(DataReportal / Statista, 2025 data).

So a Telegram bot would demo the messaging-entry pattern truthfully while being
a channel this product's users do not use. Building it would have cost hours the
employer check needed, and it would have invited exactly one question from a
judge who knows the sector - "why Telegram?" - whose honest answer is "because it
was the one we could stand up in a day."

**Say it out loud instead:** "Migrant workers use WhatsApp, not Telegram. We did
not build a Telegram bot to look like we had a messaging product."

---

## 4. Receiving payslips over any third-party messenger

**A reason the primary flow stays on our own site, not only a limitation.**

A payslip is about as sensitive as personal data gets in Singapore: name,
NRIC or FIN, salary, CPF. Routing one through a messaging platform engages the
PDPA on several fronts at once:

- **Consent and Notification** - consent, and notice of purpose, before
  collection.
- **Transfer Limitation** - data sent overseas must enjoy comparable protection,
  and a messaging operator's servers are very unlikely to be in Singapore.
- **Protection and Retention Limitation** - secure it, then delete it.

PDPC's Advisory Guidelines on Key Concepts in the PDPA:
https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/AG-on-Key-Concepts/Advisory-Guidelines-on-Key-Concepts-in-the-PDPA-1-Oct-2021.pdf

On our own site FairSlip controls the channel, states the purpose at the point
of collection, and can say truthfully what is stored. On someone else's
messenger it controls none of that. That is an argument for the web app being
the primary route, and it is the reason a messaging bot would need explicit
opt-in and notice rather than being the front door.

---

## 5. File-handling API ("double-tap a PDF and it opens in FairSlip")

**Not built. Desktop Chromium only.**

The File Handling API (`file_handlers` in the manifest plus `launchQueue`) is
"currently limited to desktop operating systems" and is absent from every mobile
browser, and from Safari and Firefox entirely.
https://developer.chrome.com/docs/capabilities/web-apis/file-handling

A phone-first product for migrant workers gains nothing from a desktop-only
file association.

---

## 6. CPF EZPay as an API rather than a file

**Not available to build against. The file IS the integration surface.**

CPF Board's documented third-party integration for contributions is the CPF
EZPay file specification - the fixed-width format the employer check already
reads - not a public REST API with an open sandbox. Some payroll vendors
advertise API submission, which implies an interface available to onboarded
payroll software rather than to any developer.

IRAS does publish an APEX API for Submission of Employment Income (AIS) with an
OAuth sandbox, but it is annual income-tax reporting, not per-payday, and
onboarding runs through Corppass.

**What ships instead:** the employer check reads a CSV mirroring the EZPay
Employer Contribution Detail Record, so it works against a file every payroll
vendor in Singapore already generates. See `backend/fairslip/employer.py`.

**What it would take:** payroll-vendor onboarding, or Corppass/APEX registration.
Neither is a code problem either.

---

## Adjacent things worth building next, in order

1. **A shareable read-only result link for a caseworker.** After a
   reconciliation, a signed expiring URL the worker can send to a TWC2, HOME or
   MWC case officer. Hours of work; it is a read-only view of output that
   already exists. The strongest distribution idea on this list, and it pairs
   with the employer check rather than competing with it.
2. **The employer check as an NGO batch tool.** Already the same code: a case
   officer loading several workers' figures gets the same exceptions table.
   Employer pays, NGO uses free.
3. **"Check my CPF" from a member's own contribution history** - CPF Board's own
   member guidance tells workers to verify wages and CPF paid against their pay
   slip. A new parser, so not a day's work.
4. **An embeddable read-only widget for an NGO's own site.** Real distribution;
   too much surface to secure safely in the time available.

---

## What could not be verified

- **The exact Vibe For Good 2026 judging weights and judge roster.** Working
  from the brief's statement of five equally-weighted columns.
- **"68% of Singaporean WhatsApp users use it for work"** - traced only to a
  marketing trade blog. Directional at best; the ~80% / 49.2% reach figures are
  better sourced. Do not say the 68% on stage.
- **WhatsApp onboarding timings** are a vendor's self-reported dataset, not an
  independent audit.
