# Releasing

How a change gets from a branch to production.

## The flow

```
feature/*  ──PR──►  develop  ──rolling release PR──►  main  ──push──►  production
                                    (#404)                   deploy.yml
```

- **`develop`** is the default branch and the target for every feature PR.
- **`release-pr.yml`** keeps a single `develop → main` PR open and rewrites its
  body with the changelog on every push to `develop`.
- **Merging that PR is the release.** The push to `main` triggers `deploy.yml`.
- A release where every commit is Dependabot's ships itself: the workflow waits
  for checks, merges, and dispatches the deploy.

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

1. **Land the features.** Feature PRs merge into `develop`. CI must be green.
2. **Triage Dependabot.** Its PRs target `develop` and will join the release.
   Major-version jumps deserve their own release rather than riding along with
   features.
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
