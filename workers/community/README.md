# Community Tally Worker

Anonymous voting-power heartbeat + co-sign threshold authority for the Community Governance modal.

## What it does

- Each time a user opens the Community modal, the client POSTs `{ deviceId, power, completedFigures }` to `/v1/community/power`.
- The worker stores a hashed device record and updates the aggregate `{ joinedCount, totalPower }`.
- The aggregate is returned in the same response, along with the **current co-sign threshold** and **phase label** for that community size.
- The modal renders the aggregate as social proof ("Joined: 1,247 voices · Total community power: 4,892") and the threshold transparently ("Suggestions need 7 co-signs to reach review · Growing community").

## Privacy model

- Device IDs are SHA-256 hashed with a rotating `IP_SALT` before persistence. We never store the raw client UUID.
- IPs are SHA-256 hashed with the same salt and only used for a 6-hour write rate-limit. Not persisted long-term.
- No PII, no cookies, no third-party analytics. Aligned with the "No User Tracking" posture (aggregate event counters only).
- **Rotate `IP_SALT` quarterly** to make hashes uncorrelatable across rotations.

## Endpoints

| Method  | Path                         | Purpose                                        |
|---------|------------------------------|------------------------------------------------|
| POST    | `/v1/community/power`        | Register/update a device's voting power        |
| GET     | `/v1/community/snapshot`     | Read aggregate + current threshold             |
| OPTIONS | any                          | CORS preflight                                 |

### POST /v1/community/power

```json
{
  "deviceId": "<client UUID>",
  "power": 4,
  "completedFigures": 3
}
```

Response (200):
```json
{
  "joinedCount": 1247,
  "totalPower": 4892,
  "updatedAt": 1754392010002,
  "coSignThreshold": 7,
  "thresholdPhase": "Growing community"
}
```

Validation: `power` ∈ [0, 31], `completedFigures` ∈ [0, 30], `deviceId` length 8–128.

## Threshold scaling

The co-sign threshold is the number of community endorsements a Council-tier user's suggestion needs before it surfaces to ChipMates' moderation queue. It scales with the size of the active community so that the *bar* feels constant: small community, low bar; large community, higher bar.

| Active users (joined) | Threshold | Phase label              |
|----------------------:|----------:|--------------------------|
| < 250                 | **3**     | Launch phase             |
| 250 – 2,499           | **7**     | Growing community        |
| 2,500 – 24,999        | **15**    | Established community    |
| 25,000 – 249,999      | **30**    | Large community          |
| ≥ 250,000             | **60**    | Global community         |

The phase label is shown in the modal alongside the threshold so users always know which band the platform is in. Threshold changes are not silent. A release note announces each transition.

**Why not a smooth formula?** Predictable phase transitions are easier to communicate than a continuously-shifting number. Users can plan: "I need 3 co-signs for this idea to surface." A formula like `√(active)/2` is fairer on paper but opaque in conversation.

## Security model: middle way

The platform is non-binding governance, not finance. The threat model reflects that.

### What we defend against

| Threat                          | Mitigation                                                                          |
|---------------------------------|-------------------------------------------------------------------------------------|
| Drive-by submission spam        | Suggestion costs 1 of N rare slots, must articulate "why" (50+ chars)               |
| Sybil attacks (fake devices)    | Each fake account needs hours of figure completion; per-IP 6h rate-limit            |
| Localstorage tampering          | Server caps `power ≤ 31` and `completedFigures ≤ 30`; client claim is a signal only |
| Replay attacks                  | Heartbeat is idempotent; replays are harmless                                       |
| DDoS / volume                   | Cloudflare's built-in DDoS protection + KV write quota                              |
| Coordinated brigading           | Threshold scales with community; ChipMates moderation is final filter               |
| Vote tampering pre-submit       | All co-signs and suggestions pass through the worker; client can't bypass           |

### What we don't defend against

- **A determined attacker spending 10+ hours per fake account.** The economic cost outweighs any benefit (non-binding signal, ChipMates moderation queue at the end).
- **Genuine community organizing.** Friend groups can co-sign each other's suggestions. This is a feature, not a bug. ChipMates moderation handles end-stage filtering.
- **Cryptographic completion proof.** We don't ship Merkle proofs of seed completion; client claims are accepted because the stakes don't justify the complexity.

This is intentionally *not* banking-level security. The cost of a false vote is "ChipMates rejects it at moderation", not financial loss.

## Operational notes

- KV writes are eventually consistent. The aggregate may lag a few seconds.
- The 6-hour per-IP write rate-limit means a user opening the modal repeatedly only updates the aggregate every 6 hours. Reads are unrestricted.
- At sustained 5–10 writes/sec (≈ 500k DAU), Cloudflare KV is comfortable. Beyond that, migrate to D1 with atomic counters or to Durable Objects per-shard.

## Setup

1. Install deps: `pnpm install` (or `npm install`).
2. Create the KV namespace:
   ```sh
   wrangler kv:namespace create COMMUNITY_KV
   wrangler kv:namespace create COMMUNITY_KV --preview
   ```
   Paste the resulting IDs into `wrangler.toml`.
3. Set the salt:
   ```sh
   echo $(openssl rand -hex 32) | wrangler secret put IP_SALT
   ```
4. Deploy:
   ```sh
   wrangler deploy
   ```
5. Wire the route in Cloudflare dashboard or uncomment the `[[routes]]` block in `wrangler.toml`.

## Local dev

```sh
wrangler dev
```

Listens on `http://localhost:8789`. The frontend reads `VITE_COMMUNITY_API_URL` to point at it during dev:

```env
# client/.env
VITE_COMMUNITY_API_URL=http://localhost:8789
```

## Quarterly maintenance

- **Rotate `IP_SALT`**. After rotation, old hashes are uncorrelatable (so the same device that visited last quarter looks like a new device). Aggregate counts will drift up by ~the share of returning users; this is acceptable and, if anything, a tighter privacy stance.
- **Review the threshold ladder**. If the community has grown into a new phase, the worker reads it automatically, but check the modal copy reads correctly and announce the change in the next release note.
- **Audit KV size**. Each device record is ~150 bytes. At 500k DAU = ~75 MB, well under any limit.
