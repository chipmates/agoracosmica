## What does this PR do?

<!-- One to three sentences. Link the issue it closes, if there is one. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Content update (figures, translations, factchecks)
- [ ] Documentation
- [ ] Performance
- [ ] Accessibility
- [ ] Refactoring (no functional change)
- [ ] CI, build or tooling

## Checklist

CI runs the first four from `client/`. Running them yourself saves a round trip.

- [ ] `pnpm exec tsc --noEmit` reports 0 errors
- [ ] `pnpm lint` reports 0 errors (warnings pass)
- [ ] `pnpm test:unit` passes
- [ ] `pnpm build` completes
- [ ] Commit subject is imperative and under 72 characters (`Fix`, `Add`, `Drop`), and no message names a person
- [ ] Both `ui-en.json` and `ui-de.json` are updated, if UI text changed
- [ ] Tested on a mobile viewport, if the UI changed
- [ ] Colors come from CSS variables, with no hex codes
- [ ] Interactive elements keep the 44 px minimum touch target

## Screenshots

<!-- For a visual change, before and after. Remove this section otherwise. -->
