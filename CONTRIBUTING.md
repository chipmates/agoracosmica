# Contributing to Agora Cosmica

Contributions welcome from developers, translators, historians, philosophers, and anyone who cares about making wisdom accessible.

By participating, you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Where to start

- **Found a bug?** Open an [issue](https://github.com/chipmates/agoracosmica/issues) using the bug-report template.
- **Have a question?** Ask in [Discussions](https://github.com/chipmates/agoracosmica/discussions).
- **Want to translate?** See [Translations](#translations) below.
- **Want to vote on what we build next?** Use the **Community panel inside the app**. No GitHub account needed.
- **Want to suggest content?** (council topic, factcheck correction, figure addition) In-app Community panel (preferred, lets others co-sign) or open an issue.
- **Have a feature idea?** Discuss it in [Discussions](https://github.com/chipmates/agoracosmica/discussions) before opening a PR.
- **Found a security issue?** See [SECURITY.md](SECURITY.md). Do not use public issues.

---

## Setup

Prerequisites: Node.js 20+, pnpm 8+ (not npm or yarn).

```bash
git clone https://github.com/chipmates/agoracosmica.git
cd agoracosmica/client
pnpm install
pnpm setup:assets    # download content from CDN (~30 MB, one time)
pnpm dev
```

The dev server starts at [localhost:5173](http://localhost:5173). The free tier works immediately, no API key needed. Why the separate `setup:assets` step: see [CONTENT-LICENSE.md](CONTENT-LICENSE.md). Re-running is safe, existing files are skipped.

Before opening a PR:

```bash
pnpm build
pnpm test
npx tsc --noEmit
```

All three should pass. If they don't, open a [Discussion](https://github.com/chipmates/agoracosmica/discussions) and we will help.

---

## Code standards

- **TypeScript strict**, functional React with hooks, zero `tsc --noEmit` errors.
- **CSS via custom properties** (no hex codes), `color-mix()` for transparency (not `rgba()`), 44 px minimum touch targets (WCAG 2.2 AA).
- **pnpm only.** Do not commit `package-lock.json` or `yarn.lock`.

---

## Translations

Bilingual English + German. Strings live in JSON files:

| File | Contents |
|---|---|
| `client/src/assets/translations/ui-en.json` | English UI strings |
| `client/src/assets/translations/ui-de.json` | German UI strings |
| `client/src/assets/translations/seeds/{en,de}/` | Wisdom teaching text (per figure) |
| `client/src/assets/translations/figures/{en,de}/` | Figure descriptions |

Edit the value (not the key), test in the running app, open a PR. UI string changes must update both `ui-en.json` and `ui-de.json`.

To add a new language, use the **Community panel inside the app** (where users co-sign language requests) or open a [Discussion](https://github.com/chipmates/agoracosmica/discussions).

---

## Pull Requests

- **Small and focused.** One concern per PR.
- **Tests pass, TypeScript clean.**
- **Mobile-tested** if a UI change.
- **Both languages updated** if UI text changes.
- **Accessibility kept** (44 px touch targets, keyboard navigation, screen reader compatibility).
- **Honest commit messages** that summarize the *why*, not just the *what*.

---

## Community participation

You don't need to write code to shape Agora Cosmica. The **Community panel inside the app** is where users vote on figures, council topics, languages, and features. No GitHub account needed. Privacy-preserving by design (device identifiers SHA-256 hashed with a rotating salt, no PII stored). See `workers/community/` for the implementation.
