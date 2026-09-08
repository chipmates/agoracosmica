# Workflows

What GitHub Actions runs on this repository, and what a pull request has to pass.

| Workflow | Runs on | What it does |
|---|---|---|
| `ci.yml` | push to `main`, pull requests into `main`, manual dispatch | type check, lint, unit tests and build for the client, a type check for every worker, tests for the two workers that have them, and a docker build of the self-host image |
| `docker-publish.yml` | a pushed `v*` tag, manual dispatch | builds the four self-host images and pushes them to `ghcr.io/chipmates` |

Node comes from `.nvmrc`, pnpm from the `PNPM_VERSION` variable at the top of `ci.yml`, which mirrors the `packageManager` field in `client/package.json`. The repository has no workspace root, so every package installs from its own lockfile.

## What blocks a merge

`ci.yml` has three jobs.

`check` works in `client/` and `marketing/`. It installs both, fetches the content assets from the CDN, generates the public data files the type checks need, then type-checks the client, lints it, runs the unit tests and builds. A client type error, a lint error or a failing test stops the job. Lint warnings pass, and the marketing type check is advisory (`continue-on-error`) until the findings from the Astro strictest preset are cleared.

`workers` is a matrix over the four workers in `workers/`. Each installs from its own lockfile and type-checks. `llm-proxy` and `audio-proxy` also run their test suites.

`docker-build` waits for `check`, then builds the self-host image for `linux/amd64` without pushing it, so a broken Dockerfile shows up on the pull request.

## Publishing

`docker-publish.yml` fires on a version tag. It builds `agoracosmica`, `agoracosmica-tts-kokoro` and `agoracosmica-stt-whisper` for `linux/amd64` and `linux/arm64`, plus `agoracosmica-tts-qwen-cuda` for `linux/amd64` only, since that one is CUDA. Each image goes to `ghcr.io/chipmates` with an SBOM and a provenance attestation, and is then scanned with Trivy. The scan reports as a workflow annotation and does not gate the release: the audio images track upstream bases that carry distro CVEs with no backported fix.

The workers themselves are deployed outside GitHub Actions, with `wrangler`.

## Dependencies

`../dependabot.yml` checks all six package directories every Monday, plus the actions used here. Minor and patch updates travel together in one grouped pull request per directory, and a major update gets its own. One pin lives in that file: `@vitejs/plugin-react` majors wait for the Vite 8 migration.
