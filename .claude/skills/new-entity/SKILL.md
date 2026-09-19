---
name: new-entity
description: This skill should be used when the user asks to "add an entity", "add a new entity", "scaffold a CRUD screen", "add a resource screen", or names a new domain object (e.g. "add Invoice") that needs a spec, gateway, mocks, table, and form built following this repo's widgets reference pattern.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Add a full CRUD entity end to end. The entity name is this skill's
argument — if none was given, ask for one before proceeding.

Read `docs/add-an-entity.md` in full, then follow it exactly, in order —
starting with its "Before anything: the entity plan" section. Never guess
what the entity is: every field comes from `docs/entities/<entity>.md`,
and if that file doesn't exist you plan it with the developer and wait for
their go-ahead before building anything. That file is the only copy of the
playbook; this skill deliberately does not repeat it, so the two can't
drift apart. Do not add anything beyond what it lists — note extra ideas
in `docs/DEFERRED.md`.

This skill is a shortcut, not a gate: a developer asking in plain words
("add a Game entity following docs/add-an-entity.md") gets exactly the
same workflow, in Claude Code or any other tool. The plan requirement is
what keeps an agent from building on its own initiative.
