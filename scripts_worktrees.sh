#!/bin/sh
# Запусти один раз после мёржа в main: у каждого участника своя папка и ветка.
git worktree add ../sp-user  -b feature/user-core
git worktree add ../sp-org   -b feature/org-core
git worktree add ../sp-admin -b feature/admin-core
