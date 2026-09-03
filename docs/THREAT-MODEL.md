# Threat Model: Your API Key on This Device

Agora Cosmica lets you bring your own OpenRouter key. The key stays in your browser and travels only to OpenRouter. This page explains in plain language what protects it, and just as importantly what does not.

For the wider picture (data flows, subprocessors, edge protections) see [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md). For reporting a vulnerability see [SECURITY.md](../SECURITY.md).

---

## How the key is stored

Your key is encrypted with AES-256-GCM before anything is written to disk. The ciphertext lives in IndexedDB in your browser.

The key that encrypts it is generated on your device by the browser itself and is marked **non-extractable**. That flag is enforced by the browser, not by our code. The page can ask the browser to encrypt or decrypt with the key, but it cannot ask the browser to hand over the key bytes. The Web Crypto API refuses.

We never see the key. There is no copy on our servers and no recovery path. If you clear site data for this domain, the stored key is gone and you paste it in again.

---

## What a non-extractable key protects against

The threat here is a copy of the key travelling somewhere it can be replayed.

- A script that reaches IndexedDB, reads the stored key, and posts it to somewhere else
- A browser profile folder copied off a shared or stolen machine, then mined for key material
- A backup, a sync, or a device migration carrying a usable key along with it
- Any tool that dumps browser storage to a file, because a non extractable key serializes as a handle and never as bytes

In every one of those cases the ciphertext may well be readable. The key that opens it is not, so the ciphertext is inert once it leaves this browser.

---

## What it does not protect against

Non-extractable means the key cannot be taken away. It does not mean the key cannot be used.

Code that is already running on this origin can ask the browser to decrypt with the key, exactly the way the app does. So a non-extractable key does nothing against:

- A cross site scripting flaw in the app, which could decrypt your key and send the plaintext anywhere
- A browser extension with access to this site, which can run in the page and do the same
- Malware on your machine that drives your browser

What the change buys is a raised cost. It turns "read the key out of a file" into "get code running inside this page". Those are very different levels of effort, but the second one is a real threat and we do not claim otherwise.

---

## What keeps hostile code out of the page

The Content Security Policy is the defence for that case, and it is the reason the CSP matters more than the storage format.

The policy is a strict allowlist. Scripts load only from our own origin plus the Cloudflare Turnstile challenge host. There is no `unsafe-eval` and no blanket `unsafe-inline` for scripts, so an injected inline script has no way to run. `object-src` and `frame-ancestors` are set to `none`, `base-uri` is pinned to `self`, and network destinations are limited to our own domains plus OpenRouter.

You can read the exact policy in this repository:

- `client/index.html` carries the meta policy that ships with the app
- `client/public/_headers` carries the response header set, including the CSP, HSTS, and the frame and sniffing protections

The two are enforced together, so both have to allow a script before it runs. The live grade for the header set is linked from [SECURITY.md](../SECURITY.md) under External validation.

---

## Scope of this page

This page is about the BYOK API key. Conversation history and your profile are also encrypted at rest in your browser, and they are on a separate key path that is being brought onto the same device key.

Nothing here changes the standing limits of a browser side design. A compromised device is a compromised device. See [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md) under "What we do not defend against" for the full list.
