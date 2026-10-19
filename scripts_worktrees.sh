#!/bin/sh
# Запусти один раз: у каждого Claude своя папка и ветка, без конфликтов рабочих копий.
git worktree add ../sp-A -b feature/be-core
git worktree add ../sp-B -b feature/fe-user-core
git worktree add ../sp-C -b feature/fe-org-admin-core
