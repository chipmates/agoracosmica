# Ad consent versions

Visitors who arrive from one of our free nonprofit Google Ad Grants ads are asked whether we may count their visit for Google (see [MEASUREMENT.md](MEASUREMENT.md)). The browser keeps the answer as `agc_ad_consent`: yes or no, the version of the question it answered, and the time. This file records each version: when it was written, what the card said, how it was shown, and which answers are asked again.

Dates are commit dates from this repository's history. A version reaches visitors with the next deploy of the site, which git does not record. The exact words of any revision can be read with `git show <commit>:<file>`. The version constant lives in [`client/src/utils/public/gclidCapture.ts`](../client/src/utils/public/gclidCapture.ts) and [`marketing/public/agc-public.js`](../marketing/public/agc-public.js), and the card in [`marketing/src/islands/ArrivalChoice.tsx`](../marketing/src/islands/ArrivalChoice.tsx).

## Who is asked again

- A yes given under an older version counts as no answer: the card asks again, and a click ID kept under that yes is dropped unread. A yes covers only the text it was given to.
- A no given under any version stays a no. Declining does not widen with the text.
- Any answer older than 12 months is removed and the card asks again (from 2026-09-28, commit `1c693642`; before that an answer had no time limit).
- Visitors from paid ads (`p=1` in the address) are never asked and never have a click ID kept.

## 1.2.0, live from 14 October 2026

Written on 2026-10-14.

**How it is shown.** At once on the landing page, and only there. A card fixed to the foot of the screen: full width on upright phones, a corner card on wide screens, centred in between. It dims nothing, locks no scroll and traps no focus. On a short screen it takes at most about 55% of the height. The words scroll inside it. On short screens (at most 700 px high, phones turned sideways too) the fine print stands before the lead. Same words. The question, the age line, both answers, the links and the X stay in view. On phones, upright or turned sideways, the plate is opaque.

**The X** (new). A no for this visit: the click ID is discarded, nothing is stored, nothing is sent to Google. It is not remembered, so the next arrival from an ad is asked again. Its accessible name: "Schließen. Das zählt als Nein." / "Close. This counts as no."

**After any answer** (new) the click ID leaves the address bar. The `gclid` key stays, empty, so the anonymous source count still sees a reload as an arrival from an ad.

**What it says**, German:

> Eine Frage zu dieser Anzeige
> **Dürfen wir deinen Besuch für Google zählen?**
> Wir sind klein und gemeinnützig, und Google schenkt uns diese Anzeigen. Gezählte Besuche helfen ihnen, mehr Menschen zu erreichen, die dasselbe suchen.
> Ein Ja schickt Google die Klick-ID der Anzeige bei jedem Schritt, den du hier machst: diesem Ja, dem Öffnen der App, dem Zuhören, dem Beginn eines Gesprächs, deiner dritten Nachricht, einem Council. Google kann sie deinem Google-Konto zuordnen und auch in den USA verarbeiten. Für personalisierte Werbung geben wir sie nicht frei. Sonst nichts über dich. Dein Browser merkt sich deine Antwort ein Jahr lang. Ausschalten kannst du das jederzeit unten auf jeder Seite unter „Werbe-Messung“. So oder so bleibt die Bibliothek offen.
> Bist du unter 16, sag bitte Nein.
> [Ja, zählen] [Nein, nicht zählen]
> Code ansehen · Datenschutzerklärung · Wie Google das nutzt

English:

> One question about this ad
> **May we count your visit for Google?**
> We’re a small nonprofit, and Google gives us these ads for free. Counted visits help them reach more people searching for the same thing.
> A yes sends Google the ad’s click ID with each step you take here: this yes, opening the app, listening, starting a conversation, a third message, a council. Google can link it to your Google account and may process it in the USA. We don’t allow it for personalised ads. Nothing else about you. Your browser remembers your answer for a year. You can turn this off anytime under “Ad measurement” at the foot of every page. Either way, the whole library stays open.
> If you’re under 16, please say no.
> [Yes, count it] [No, don’t count it]
> See the code · Privacy policy · How Google uses this

**What changed from 1.1.0.** The account and USA sentence and the line on personalised ads, the age line, the X, the question naming Google, the click ID leaving the address, and the site's trust line ("Gemeinnützig · Open Source · Keine Tracking-Cookies, kein Profiling") is no longer on the card. **Re-ask:** every 1.1.0 yes is asked again, because it was given without the account and USA facts.

## 1.1.0, from 2026-09-28

Written on 2026-09-28 (commit `15be6add`). Revised in wording on 2026-09-29 (`76902d2d`, `c5637e6f`, `9cbef4d4`): the heading and the lead were reworded and the fine print tightened, with the same facts.

**How it was shown.** At once, on the landing page only: from the same day (`c9b55e69`) the click ID stayed in page memory until a yes, so later pages had none to ask about. The card at the foot of the screen, a corner card on wide screens. No X: the two answers were the only exits, and an unanswered card stayed for that page.

**What it said** at its last revision (`9cbef4d4`), German: kicker "Eine Frage zu dieser Anzeige", question "Dürfen wir deinen Besuch zählen?", the same lead and fine print as 1.2.0 without the account, USA and personalised-ads sentences, no age line, buttons "Ja, zählen" and "Nein, nicht zählen", then the trust line and the links "Code ansehen · Datenschutzerklärung · Wie Google das nutzt". English: "May we count your visit?", the same structure. The first text of 28 September (`15be6add`) asked "Damit der nächste Mensch es auch findet." / "So the next person finds it too." and named the same steps.

**What changed from 1.0.0.** The fine print named every step that sends the click ID, the year the answer is kept and the footer switch, and a link to Google's page on partner data was added. **Re-ask:** every 1.0.0 yes was asked again. For about an hour of commit history (`15be6add` to `ee64f71b`) a 1.0.0 no was asked again too. From `ee64f71b` on, a no stays a no.

## 1.0.0, from 2026-05-30

Written on 2026-05-30 (commit `3b0ba407`) as an optional checkbox in the app's welcome dialog, shown only to visitors with a click ID: "Ich kam über eine Google-Anzeige. Es ist okay, Google wissen zu lassen, dass sie funktioniert hat. Optional, es funktioniert auch ohne." / "I came from a Google ad. It is fine to let Google know it worked. Optional, everything works without it."

On 2026-06-05 (`4b9028b8`) the question moved to a card on the landing page, shown at once, fixed at the foot of the screen, with an X that hid the card for the tab's session and recorded nothing. The click ID was kept in the tab's sessionStorage from arrival, before any answer. Revisions under 1.0.0:

- 2026-06-10 (`1470db4d`): the card named how to change one's mind later.
- 2026-07-28 (`ee0dbde8`): new structure with kicker, heading, lead and fine print. The X said "Schließen. Löscht die Klick-ID." / "Close. Deletes the click ID." and deleted the stored click ID. On wide screens the card moved to a corner.
- 2026-07-30 (`0e0ef417`): the X was removed. The two answers were the only exits.

Its last text (`0e0ef417`), German: kicker "Eine Frage zu dieser Anzeige", heading "Damit der nächste Mensch es auch findet.", lead "Gemeinnützige bekommen ihre Anzeigen bei Google gratis. Gezählte Klicks helfen, mehr Menschen zu erreichen, die dasselbe suchen.", fine print "Von dir geht nur die Klick-ID der Anzeige zu Google. Kein Name, keine Browserdaten. Jederzeit widerrufbar unter Einstellungen › Rechtliches. So oder so bleibt die Bibliothek offen. Ein Nein merken wir uns.", buttons "Ja, zählen" and "Nein, nicht zählen", the trust line and the links "Code ansehen · Datenschutzerklärung". English: "So the next person finds it too.", "Nonprofits get their Google ads for free. Counted clicks help those ads reach more people searching for the same thing.", "Nothing about you goes to Google except the ad’s click ID. No name, no browsing history. You can undo it anytime under Settings › Legal. Either way, the whole library stays open. A no is remembered.", "Yes, count it", "No, don’t count it".

**Re-ask:** none within 1.0.0. Until 2026-09-28 an answer was remembered without a time limit.
