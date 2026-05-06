# Accessibility

Agora Cosmica targets **WCAG 2.2 AA** compliance across all features. Philosophical wisdom should be accessible to everyone, regardless of ability or device.

---

## Standards

| Standard | Level | Status |
|----------|-------|--------|
| WCAG 2.2 | AA | Implemented |
| Touch targets | 44px minimum (WCAG AAA) | Enforced |
| Color contrast | 4.5:1 minimum | All UI text |
| Keyboard navigation | Full | All interactive elements |
| Screen reader | ARIA labels + live regions | All components |

---

## Touch Targets

All interactive elements maintain a minimum 44×44px touch target (WCAG AAA standard, exceeding AA requirements).

- Validator at `client/src/utils/accessibility/touchTargetValidator.ts`
- Warnings logged in dev mode for any sub-44px targets
- Exemptions: inline text links (WCAG exception)
- CI integration (failing build on regressions) is on the post-launch roadmap

---

## Color and Contrast

The design system uses CSS custom properties for all colors, enforced project-wide.

| Element | Minimum Ratio |
|---------|--------------|
| Body text | 4.5:1 |
| Large text (18px+) | 3:1 |
| UI components | 3:1 |
| Focus indicators | 3:1 |

The color system uses a dark cosmic theme with gold accents. Contrast ratios for each token are documented inline in `client/src/index.css` (e.g., `--gold-primary` 7.21:1, `--text-primary` 10.8:1, `--text-dim` 4.5:1). A development helper at `pages/dev/ColorContrastTest.tsx` lets reviewers spot-check pairs.

---

## Keyboard Navigation

Every feature is fully keyboard accessible:

| Action | Key |
|--------|-----|
| Navigate between elements | Tab / Shift+Tab |
| Activate buttons and links | Enter |
| Close modals and overlays | Escape |
| Navigate within menus | Arrow keys |
| Skip to main content | Skip link (Tab from top) |

### Focus Management

- **Focus trapping** in modals (focus cannot leave the modal until closed)
- **Focus restoration** on modal close (returns to the element that opened it)
- **Focus-visible** styles for keyboard users (no focus ring for mouse users)
- **Skip links** for bypassing navigation

---

## Screen Reader Support

### ARIA Implementation

| Pattern | Usage |
|---------|-------|
| `role="main"` | Main content area |
| `aria-label` | Icon buttons, non-text interactive elements |
| `aria-live="polite"` | Dynamic content updates (messages, status) |
| `aria-describedby` | Complex components with supplementary descriptions |
| `aria-expanded` | Collapsible sections, dropdowns |

### Live Region

A `LiveRegion` component announces state changes to screen readers without visual disruption. Used for:

- New messages in conversation
- Mode transitions
- Audio playback status
- Error notifications

---

## Responsive Design

The app adapts to all screen sizes with mobile-first design.

### Breakpoints

| Size | Width | Behavior |
|------|-------|----------|
| **Mobile** | <480px | Single column, full-width, safe area aware |
| **Tablet** | 480–1024px | Adapted layout, sidebar available |
| **Desktop** | >1024px | Full layout with persistent sidebar |

### Mobile Considerations

- **Safe areas:** Respects notch, home indicator, and rounded corners via `viewport-fit=cover`
- **Dynamic viewport:** Uses `100dvh` to account for mobile browser chrome
- **Keyboard avoidance:** Input fields adjust when software keyboard appears
- **Orientation:** Portrait preferred on mobile, landscape supported on tablet/desktop

---

## Audio Accessibility

### Transcripts

All pre-recorded audio content has full text transcripts:

| Content | Transcript Format |
|---------|------------------|
| Stories | `.txt` file per story |
| Councils | Full manifest with speaker attribution |
| Prisms | Segment-level speaker labels |
| Live conversations | Real-time text display alongside audio |

### Audio Controls

- Play/pause accessible via keyboard
- Playback speed adjustment (1x, 1.25x, 1.5x)
- Progress indicator with seek capability
- Speaker labels for multi-figure content

---

## Input Methods

The app detects the input method and adapts the UI accordingly:

| Method | Adaptation |
|--------|-----------|
| **Touch** | Larger tap targets, swipe gestures |
| **Keyboard** | Enhanced focus indicators, skip links |
| **Voice (STT)** | Microphone input for speech-to-text conversation |

Detection is handled by `inputMethodDetection.ts` and updates dynamically as the user switches between methods.

---

## Testing

Accessibility is currently validated through:

- **Touch targets:** dev-mode validator at `touchTargetValidator.ts` (not yet failing CI on regressions)
- **Color contrast:** ratios documented inline in `index.css`. Manually verified per token. No automated runtime check yet.
- **Keyboard:** manual tab-through of all primary flows
- **Screen reader:** manually tested with **VoiceOver** (macOS, iOS). NVDA + JAWS coverage is on the roadmap.
- **Mobile:** manually tested on iOS Safari, Android Chrome, plus desktop browsers

### Automated testing roadmap

We do not currently run `axe-core`, `pa11y`, or Lighthouse a11y scans in CI. These are committed for the **2026-Q3 contributor-experience milestone** alongside the touch-target CI gate.

---

## Legal accessibility statement (Barrierefreiheitserklärung)

The German Barrierefreiheitsstärkungsgesetz (BFSG, implementing the EU Accessibility Act) requires consumer-facing platforms to publish a formal accessibility statement from June 2025.

We currently document our accessibility posture in this file and in the codebase. A dedicated public statement page (with reporting channels and assistive-tech feedback contact) is on the post-launch roadmap. Until that ships, accessibility issues can be reported via [GitHub Issues](https://github.com/chipmates/agoracosmica/issues) or `agoracosmica@chipmates.ai`.

---

**[← Back to README](../README.md)**
