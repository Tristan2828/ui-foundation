---
name: new-entity
description: This skill should be used when the user asks to "add an entity", "add a new entity", "scaffold a CRUD screen", "add a resource screen", or names a new domain object (e.g. "add Invoice") that needs a spec, gateway, mocks, table, view and form built following this repo's widgets reference pattern.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Add a full CRUD entity end to end. The entity name is this skill's
argument — if none was given, ask for one before proceeding.

Follow `docs/foundation/add-an-entity.md` exactly, in order. Read its
index, "Before anything: the entity plan" and "The steps" (steps 1 to 10)
in full. Then reach "Step 6 in detail" and the sections after it through
the index, reading each one the entity's plan calls for: every field type
it has, and the standard for every screen it builds. Never guess
what the entity is: every field comes from `docs/entities/<entity>.md`,
and if that file doesn't exist you plan it with the developer and wait for
their go-ahead before building anything. That file is the only copy of the
playbook; this skill deliberately does not repeat it, so the two can't
drift apart. Do not add anything beyond what it lists — note extra ideas
in the app's backlog.

This skill is a shortcut, not a gate: a developer asking in plain words
("add a Game entity following docs/foundation/add-an-entity.md") gets exactly the
same workflow, in Claude Code or any other tool. The plan requirement is
what keeps an agent from building on its own initiative.
