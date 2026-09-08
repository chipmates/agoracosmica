# Accessibility

What the interface does for keyboard, screen reader, touch and low-vision use, and how each claim is checked. Written for someone deciding whether the platform is usable for their people, and for contributors who want to keep it that way. WCAG 2.2 AA is the target we build to. No automated conformance test runs anywhere in this repository, so read the table below as a description of the code and the manual checks, and not as a certified audit.

---

## Where it stands

| Area | In the code | How it is checked |
|---|---|---|
| WCAG 2.2 AA | The target for every surface | By hand, per feature |
| Touch targets | 44 px minimum for interactive elements | A development-only validator, plus review |
| Color contrast | 4.5:1 for body text, 3:1 for large text and UI | Ratios recorded next to each token in `index.css` |
| Keyboard | Every interactive element reachable and operable | Manual tab-through of the main paths |
| Screen reader | ARIA labels, live regions, landmarks, skip links | Manual passes with VoiceOver |

---

## Touch targets

Interactive elements are built to a 44 by 44 px minimum, which is the WCAG 2.2 AAA target size and above the AA requirement. Inline text links are exempt, as WCAG allows.

The check lives at [`client/src/utils/accessibility/touchTargetValidator.ts`](../client/src/utils/accessibility/touchTargetValidator.ts). It measures every visible interactive element and logs anything under 44 px. It is imported only when `import.meta.env.DEV` is true, so it runs while a developer works and never in a production build. It writes warnings and fails nothing. There is no CI gate for touch targets.

---

## Color and contrast

Every color in the interface comes from a CSS custom property in [`client/src/index.css`](../client/src/index.css), and hex values in components are treated as a bug. The contrast ratio of each token is recorded in a comment next to it: `--gold-primary` at 7.21:1, `--text-primary` at 14.2:1, `--text-dim` at 5.1:1.

| Element | Minimum ratio |
|---|---|
| Body text | 4.5:1 |
| Large text (18 px and up) | 3:1 |
| UI components | 3:1 |
| Focus indicators | 3:1 |

`client/src/components/ColorContrastTest.tsx` is a development page for spot-checking pairs while working on the palette. Ratios are verified per token by hand. Nothing measures them at runtime.

---

## Keyboard

| Action | Key |
|---|---|
| Move between elements | Tab, Shift+Tab |
| Activate a button or link | Enter |
| Close a dialog or overlay | Escape |
| Move within a carousel or list | Arrow keys |
| Skip to main content | Skip link, first Tab on the page |

Dialogs go through one of two shared shells, `ModalContainer` or the `useFocusTrap` hook. Both hold focus inside the dialog while it is open, close it on Escape, and return focus to the element that opened it. Focus rings show for keyboard use and stay out of the way for pointer use, through `:focus-visible`.

---

## Screen readers

| Pattern | Where it is used |
|---|---|
| `<main>` landmark | The main content region of the app and of every public page |
| `aria-label` | Icon buttons and other controls without visible text |
| `aria-live="polite"` | New messages, playback state, status changes |
| `aria-describedby` | Controls that need a longer description than their label |
| `aria-expanded` | Collapsible sections and dropdowns |

A `LiveRegion` component announces changes that have no visual equivalent for a screen reader user: a new message in a conversation, a change of format, audio playback state, and errors.

---

## Layout

The layout is built mobile first and shifts at three widths that recur through the stylesheets: 480 px, 768 px and 1024 px. One column on a phone, a wider layout with the sidebar available on a tablet, and a persistent sidebar on a desktop.

- **Safe areas.** `viewport-fit=cover` plus the safe-area insets, so a notch or a home indicator never sits on a control.
- **Dynamic viewport.** `100dvh` for full-height surfaces, so mobile browser chrome keeps the last row visible.
- **Software keyboard.** Input fields stay in view when the software keyboard opens.
- **Orientation.** Portrait is the primary shape on phones. Both orientations work on tablet and desktop.

---

## Audio

Everything pre-recorded has its text. Live speech shows the same text it speaks.

| Content | Text form |
|---|---|
| Story chapters | A `.txt` transcript per chapter, plus character-level timestamps |
| Councils | A manifest with the full text per segment and the speaker on each |
| Prisms | The same, segment by segment |
| Live conversation | The reply appears as text as it is spoken |

Playback controls are reachable by keyboard. Speed runs from 0.5x to 2x in steps of 0.05, the progress bar can be seeked, and multi-voice recordings label the speaker.

---

## Input methods

The app detects how someone is interacting and adapts: larger tap areas and swipe gestures for touch, stronger focus indicators and skip links for keyboard, and microphone input where speech-to-text is available. Detection lives in `client/src/utils/inputMethodDetection.ts` and updates when the input method changes mid-session.

---

## How this is tested

- **Touch targets.** The development validator above. Warnings, not a gate.
- **Color contrast.** Ratios verified per token by hand and recorded in `index.css`. No runtime check.
- **Keyboard.** Manual tab-through of the main paths before a release.
- **Screen reader.** Manual passes with VoiceOver on macOS and iOS. NVDA and JAWS are not covered.
- **Devices.** Manual passes on iOS Safari, Android Chrome and desktop browsers.

What CI runs is type checking, linting, unit tests, worker tests and a build. It runs no accessibility scan: there is no `axe-core`, no `pa11y` and no Lighthouse in the repository, and no touch-target gate. Wiring one in is worth doing and is not scheduled. If you want to take it on, [CONTRIBUTING.md](../CONTRIBUTING.md) is the place to start.

---

## The legal statement (BFSG)

The German Barrierefreiheitsstärkungsgesetz, which implements the EU Accessibility Act, has required consumer-facing digital services to publish a formal accessibility statement since June 2025.

That page is not published yet. This file and the code are the current description of where the interface stands. Accessibility problems can be reported through [GitHub Issues](https://github.com/chipmates/agoracosmica/issues) or to `agoracosmica@chipmates.ai`, and a report that names the assistive technology and the page is the fastest kind to act on.

---

**[← Back to README](../README.md)**
