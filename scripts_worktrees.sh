#!/bin/sh
# Запусти один раз: у каждого Claude своя папка и ветка, без конфликтов рабочих копий.
git worktree add ../sp-A -b feature/events-core
git worktree add ../sp-B -b feature/org-admin-core
git worktree add ../sp-C -b feature/core-skeleton
