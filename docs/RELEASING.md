# Releasing

How a change gets from a branch to production.

## The flow

```
feature/*    ──PR──►  main  ──►  production (deploy.yml, scoped to what changed)

dependabot/* ──PR──►  main      human merge, or deps-nightly-merge.yml for
                                semver-patch bumps 01:00–04:00 SAST
```

- **`main`** is the default branch, the target for every PR, and what production
  runs. Merging a PR is the deploy.
- **Release branches are retired** (2 Nov 2026), and so is `develop` (29 Sep 2026).
  `release-pr.yml` only reacts to `release/**` and is inert.

## What may deploy itself — and what may not

Until 12 Nov 2026 the rule was that no automation merges to `main`. On
2026-08-29 `release-pr.yml` auto-merged a release it wrongly judged
Dependabot-only (`git log --no-merges` could not see a human merge commit); it
deployed unreviewed, failed its health check and rolled back.

On 12 Nov 2026 Ryno changed the rule (trinext-ai-hive#16): dependency updates
that are **semver-patch only** merge themselves at night, because months-old
critical advisories (#570) were the larger risk. `deps-nightly-merge.yml` is
built so the August failure cannot repeat:

- It judges each PR from Dependabot's own `updated-dependencies:` commit metadata
  — every dependency must be `semver-patch`, none on `DEPS_DENY`
  (`@medusajs/*`, `next`, `react`) — and every commit must be Dependabot's.
- Every required check (`DEPS_REQUIRED_CHECKS`) must have passed on the exact
  head it merges (`--match-head-commit`).
- One PR per run, 01:00–04:00 SAST, never 02:00–02:45 (the box's reboot window).
  It dispatches `Deploy to Production`, waits for it, smoke-tests the live
  URLs, and on any failure opens an issue and a revert PR.
- It is **off** (dry run, logging what it would merge) until the repo variable
  `DEPS_AUTOMERGE` is `on` — which waits for full-stack customer-flow E2E (#571),
  so that a green run means a customer can still buy.

Everything else — features, fixes, minor and major bumps, Medusa — is still a
human merge.

## Why features go straight to `main`

Until 29 Sep 2026 features went through `develop` so releases could be batched
and announced. In practice `develop` drifted twice: 58 commits behind in August
and 22 behind in September, both times because urgent work went to `main`
directly. Every drift made the default branch lie to anyone cloning the repo, and
made "Closes #N" in PRs to `main` silently do nothing.

What made direct-to-`main` affordable is that deploys are now scoped
(`PROD-DEPLOY.md` §6). A web-only change deploys in about a minute, an nginx
change in about 20 seconds, and nothing reruns migrations unless the backend
changed. Batching now lives in milestones and release notes, not in a branch.

## Shipping a change

1. **Branch from `main`** (`feat/…`, `fix/…`, `chore/…`) and open a PR into `main`.
   CI must be green, and the PR carries the issue's milestone.
2. **Merge it.** This deploys, scoped to what changed. Watch the run: it has to
   reach `✓ Deploy complete`, and the public health checks are part of it.

## Dependency updates

1. **Dependabot opens PRs daily at 00:00 SAST** against `main`. Patch bumps come
   grouped; minor bumps come one dependency per PR.
2. **Patch bumps** merge themselves overnight once `DEPS_AUTOMERGE=on` (see above).
   Check the Actions tab for the "Nightly dependency merge" run log — it lists
   every PR it skipped and why.
3. **Everything else** waits for a human: review, merge, watch the deploy reach
   `✓ Deploy complete`.

## Tagging

When a milestone closes, create the GitHub release with notes covering what
shipped in it.

## Verifying a deploy

- `https://www.tse.co.za`, `https://tse-cartridges.co.za` (must 301 to www) and
  `https://api.tse-cartridges.co.za/health`
- The deploy workflow's own public health checks must pass before it completes.
- Database backups run nightly to R2; see `docs/PROD-DEPLOY.md` for restore.

## Release notes

Write for someone who was not in the repo that month. Group by what changed for
a user, not by commit type, and say plainly what still needs a human — a repo
setting, a client action, a manual verification. See the `v0.3.0` draft for the
shape.
