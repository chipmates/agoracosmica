# Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push to `main`, pull requests | unit tests, type check, build |

All steps run from `./client/` (the React app). Worker packages under `workers/*/` are built and deployed separately via `wrangler`.
