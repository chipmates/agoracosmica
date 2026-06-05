# Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push to `main`, pull requests | unit tests, type check, build |
| `docker-publish.yml` | push to `main`, version tags `v*` | build and push the 4 self-host images to GHCR (multi-arch) |

All steps run from `./client/` (the React app). Worker packages under `workers/*/` are built and deployed separately via `wrangler`.
