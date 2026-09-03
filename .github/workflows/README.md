# Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push to `main`, pull requests | type check, lint, unit tests, build (client + marketing), plus type check and tests per worker |
| `docker-publish.yml` | push to `main`, version tags `v*` | build and push the 4 self-host images to GHCR (multi-arch) |

`ci.yml` has three jobs: `check` runs from `./client/` and `./marketing/`, `workers` is a matrix over `workers/*/` (each package installs from its own lockfile), and `docker-build` builds the self-host image. Workers are still deployed separately via `wrangler`.

Dependency updates are configured in `../dependabot.yml` (npm per package directory, plus github-actions, weekly).
