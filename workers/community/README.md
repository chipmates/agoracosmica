# Community tally worker

The Cloudflare Worker behind the Community panel in the app. It counts how many devices have earned voting power, adds up that power, and tells the panel which co-sign threshold applies at the current community size. That is its whole job. Voting is not open yet, and no vote and no suggestion passes through this worker.

## What it does

When the Community panel opens, the client posts an anonymous device id along with the voting power it computed in the browser and its completed-figure count. The worker hashes the device id, stores a record under that hash, updates one aggregate (`joinedCount` and `totalPower`), and answers with that aggregate plus the co-sign threshold and phase label for the new size. The panel shows the aggregate as social proof ("Joined, 1,247 voices" and "Total community power") and turns the threshold into a sentence about how many backers bring a suggestion to review.

The threshold is derived at read time from `joinedCount` and never persisted, so it cannot drift out of step with the ladder below.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/community/power` | Register or update one device's voting power, and read the aggregate back |
| GET | `/v1/community/snapshot` | Read the aggregate and the current threshold |
| OPTIONS | any | CORS preflight |

Every other path answers `404 not_found`.

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

All three fields are required. `deviceId` is a string of 8 to 128 characters, `power` a finite number from 0 to 31, `completedFigures` a finite number from 0 to 30. Anything outside that gets `400 invalid_payload`, and a body that is not JSON gets `400 invalid_json`.

A device that already wrote within the last six hours is not written again. It still gets a 200 with the current aggregate, so the panel always has numbers to show.

Cross-origin requests are checked against the `ALLOWED_ORIGINS` allowlist in `wrangler.toml`. An origin outside the list gets the first allowed origin echoed back, and an empty allowlist gets no `Access-Control-Allow-Origin` header at all, which the browser then rejects. The wildcard is never reflected.

## What it stores, and what it never stores

One KV namespace, three kinds of key:

| Key | Value | Lifetime |
|---|---|---|
| `device:<hash>` | that device's `power`, `completedFigures`, `lastSeen` | no expiry |
| `aggregate:snapshot` | `joinedCount`, `totalPower`, `updatedAt` | no expiry |
| `rl:<hash>` | write marker for the rate limit | 6 hours |

Both hashes are SHA-256 over the `IP_SALT` secret and the value, so the raw client UUID is never persisted. The caller's address is hashed the same way and used only as the rate-limit key, which expires with it.

The worker holds no PII, no cookies, no message content, and no key that would join a row here to a row in any other counter. It never sees a conversation.

## The co-sign threshold

The co-sign threshold is how many backers a Council-tier suggestion needs before it reaches ChipMates for review. It scales with the size of the community so that the bar feels roughly constant.

| Devices counted (`joinedCount`) | Threshold | Phase label |
|---|---|---|
| under 250 | 3 | Launch phase |
| 250 to 2,499 | 7 | Growing community |
| 2,500 to 24,999 | 15 | Established community |
| 25,000 to 249,999 | 30 | Large community |
| 250,000 and up | 60 | Global community |

The phase label travels with every response, so the panel can say which band the platform is in. A phase change is announced in the release notes, so the number never moves under the community's feet.

A ladder beats a formula here because a predictable step is easier to talk about than a number that moves with every write. Someone can plan around "three backers". `√(active)/2` is fairer on paper and opaque in conversation.

## What the numbers can and cannot prove

`power` and `completedFigures` are the client's own claim about progress it computed in the browser. The worker bounds that claim (31 and 30 are the ceilings the app's formula can reach) and stores it. It does not verify that any teaching was completed. Read the aggregate as a bounded self-reported count.

Two more limits are worth knowing before quoting the numbers:

- Device records never expire, so `joinedCount` is a running total of every device that has ever written. The currently active count is smaller. Rotating `IP_SALT` makes returning devices look new, which pushes the total up again.
- The six-hour gate is keyed to the hashed address, so several people behind one address share it. The later ones get the snapshot back without a write of their own.

The stakes are set low on purpose. This is a non-binding signal with a human review step behind it, and the cost of a false claim is that ChipMates does not act on it.

## Run it locally

```sh
pnpm install
npx wrangler dev
```

`wrangler.toml` pins the dev port to 8789. The client picks the worker up from an env var:

```env
# client/.env
VITE_COMMUNITY_API_URL=http://localhost:8789
```

Without that var the client calls `https://community.agoracosmica.org`. As of September 2026 that hostname has no route bound (the `[[routes]]` block in `wrangler.toml` is commented out), so the heartbeat fails. It is best-effort by design and fails silently, and the panel goes on working from the state it computed locally.

## Deploy

1. Create the KV namespace and paste the ids into `wrangler.toml`:
   ```sh
   wrangler kv:namespace create COMMUNITY_KV
   wrangler kv:namespace create COMMUNITY_KV --preview
   ```
2. Set the salt:
   ```sh
   echo $(openssl rand -hex 32) | wrangler secret put IP_SALT
   ```
3. Deploy:
   ```sh
   wrangler deploy
   ```
4. Bind the route, either in the Cloudflare dashboard under Workers, Triggers, or by uncommenting the `[[routes]]` block in `wrangler.toml`.

## Maintenance

Rotate `IP_SALT` about once a quarter. After a rotation the old hashes no longer match, which is the point: a device that visited last quarter looks like a new one. Aggregate counts drift up by roughly the share of returning devices, and that is the price of hashes that cannot be correlated across rotations.

KV writes are eventually consistent, so the aggregate can trail the last heartbeat by a few seconds. Each device record is about 150 bytes, so even a large community stays small in KV terms. At five to ten writes a second, roughly what 500,000 daily devices produce at one write per six hours, KV is comfortable. Past that, the aggregate wants D1 with atomic counters or a Durable Object per shard.

When the community grows into a new phase the worker picks the threshold up on its own. Check that the panel copy still reads correctly at the new number, and put the change in the next release note.
