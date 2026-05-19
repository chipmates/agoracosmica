// Deployment mode.
//
// Agora Cosmica ships in two shapes from one codebase:
//
//   Hosted build (agoracosmica.org): free tier plus BYOK, full audio,
//   anonymous usage counters, Turnstile bot-check.
//
//   Self-host build (Docker): BYOK only, no free tier, no usage beacons,
//   no Turnstile. Pre-recorded audio and all six modes work unchanged;
//   live voice stays off unless the operator configures an audio endpoint.
//
// VITE_SELF_HOST=true at build time selects the self-host build. The Docker
// image sets it; the hosted build leaves it unset. Every behaviour that
// differs between the two builds reads `isSelfHost` from this module, so the
// switch lives in exactly one place.

/**
 * True when this is a self-host build (VITE_SELF_HOST=true at build time).
 *
 * Guards the self-host differences: BYOK-only LLM routing, no free-tier
 * session or quota, silent analytics, skipped Turnstile, and audio that
 * stays off until an endpoint is configured.
 *
 * Vite inlines VITE_SELF_HOST at build time, so branches guarded by this
 * constant are tree-shaken out of the build that does not need them.
 */
export const isSelfHost: boolean = import.meta.env.VITE_SELF_HOST === 'true';
