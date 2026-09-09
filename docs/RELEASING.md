# Releasing

How a change gets from a branch to production.

## The flow

```
feature/*  ──PR──►  develop  ─────┐
                                  ├──►  release/YYYY-MM  ──human PR──►  main  ──►  production
dependabot/*  ──auto-merge────────┘        (rolling release PR)                    deploy.yml
```

- **`develop`** is the default branch and the target for every feature PR.
- **`release/YYYY-MM`** is the release branch, cut per cycle. Dependabot targets
  it directly and its green PRs auto-merge there, source branch deleted.
- **`release-pr.yml`** keeps a single `release/* → main` PR open and rewrites its
  body with the changelog on every push to the release branch.
- **Merging that PR is the release**, and it is always a human action. The push
  to `main` triggers `deploy.yml`.

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

## Why not merge features straight into `main`

It works, and that is the problem — it deploys each change to production on its
own, with no batching and nothing to announce. Between 2026-08-06 and 2026-08-29
every feature went in that way. `develop` fell 58 commits behind, the rolling
release PR had nothing to describe, and anyone cloning the repo got a two-month
stale default branch. 248 commits reached production without ever appearing in a
release.

If you need a single urgent fix in production, that is what a hotfix PR into
`main` is for — but backmerge `main` into `develop` immediately afterwards, or
the same drift starts again.

## Cutting a release

0. **Cut the branch.** `git checkout -b release/YYYY-MM develop`, push it, and
   update `target-branch` in `.github/dependabot.yml` to match. The rolling
   release PR opens itself on the first push.
1. **Land the features.** Feature PRs merge into `develop`, then `develop`
   merges into the release branch. CI must be green.
2. **Triage Dependabot.** Its PRs target the release branch and auto-merge on
   green. Major-version jumps are labelled `major-bump` and wait for a human —
   they deserve their own release rather than riding along with features.
3. **Check the release PR.** `release-pr.yml` keeps it current; confirm its
   changelog matches what you expect to ship.
4. **Merge it.** This deploys. `scripts/prod-deploy.sh` smoke-tests the backend
   image before swapping containers, and the workflow rolls back on a failed
   health check.
5. **Tag and publish.** Create the GitHub release with notes covering what
   shipped. Milestone the issues so the next set of notes writes itself.

## Verifying a deploy

- `https://tse-cartridges.co.za` and `https://api.tse-cartridges.co.za/health`
- The deploy workflow's own public health checks must pass before it completes.
- Database backups run nightly to R2; see `docs/PROD-DEPLOY.md` for restore.

## Release notes

Write for someone who was not in the repo that month. Group by what changed for
a user, not by commit type, and say plainly what still needs a human — a repo
setting, a client action, a manual verification. See the `v0.3.0` draft for the
shape.
