# Releasing

How a change gets from a branch to production.

## The flow

```
feature/*  ──PR──►  main  ──►  production (deploy.yml, scoped to what changed)

dependabot/*  ──auto-merge──►  release/YYYY-MM  ──human PR──►  main
                                  (rolling release PR)
```

- **`main`** is the default branch, the target for every feature and fix PR, and
  what production runs. Merging a PR is the deploy, and it's always a human action.
- **`release/YYYY-MM`** batches dependency updates only. Dependabot targets it,
  its green PRs auto-merge there, and `release-pr.yml` keeps one
  `release/* → main` PR open with a changelog. Merging that PR ships the batch.
- **`develop` is retired** (29 Sep 2026). Don't branch from it or target it.

## Nothing deploys itself

There is no automation anywhere that deploys, and none that merges to `main`.
`deploy.yml` runs on a push to `main` or a manual dispatch, and the only thing
that pushes to `main` is a person merging the release PR.

This is deliberate. `release-pr.yml` used to auto-merge and dispatch a deploy
when a release looked Dependabot-only, deciding that with
`git log --no-merges`. On 2026-08-29 a human merge commit was invisible to that
check, so the release merged itself and deployed unreviewed. It failed its
health check and rolled back, but no automation should have been able to make
that call. Auto-merge now only ever targets a `release/*` branch, so the worst
it can do is put a dependency bump on a branch nobody has shipped yet.

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

## Dependency releases

0. **Cut the branch** once per cycle: `git checkout -b release/YYYY-MM main`, push
   it, and update `target-branch` in `.github/dependabot.yml` to match. The
   rolling release PR opens itself on the first push.
1. **Triage Dependabot.** Its PRs target the release branch and auto-merge on
   green. Major-version jumps are labelled `major-bump` and wait for a human.
2. **Check the release PR.** `release-pr.yml` keeps it current. Confirm the
   changelog matches what you expect to ship.
3. **Merge it.** This deploys. The workflow rolls back on a failed health check.

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
