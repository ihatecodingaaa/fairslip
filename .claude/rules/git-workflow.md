# Git workflow (two-person team)

- `main` is always demo-ready. Never commit directly to it.
- Branch naming: `feat/<area>-<initials>`, e.g. `feat/repair-loop-lc`, `feat/ui-jd`.
- One owner per area. Do not edit files outside your area without saying so.
- Parallel sessions use git worktrees, one worktree per Claude session:
  `git worktree add ../<project>-ui feat/ui-jd`
- I run `git commit` and `git push` myself. Do not run them.
- `.claude/` is committed and shared. Machine-specific settings go in
  `.claude/settings.local.json`, which is gitignored.
