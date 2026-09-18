---
name: new-entity
description: This skill should be used when the user asks to "add an entity", "add a new entity", "scaffold a CRUD screen", "add a resource screen", or names a new domain object (e.g. "add Invoice") that needs a spec, gateway, mocks, table, and form built following this repo's widgets reference pattern.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Add a full CRUD entity end to end. The entity name is this skill's
argument — if none was given, ask for one before proceeding.

Read `docs/add-an-entity.md` in full, then execute every numbered step in
it, in order, starting with Step 0. That file is the only copy of the
playbook; this skill deliberately does not repeat it, so the two can't
drift apart. Do not skip steps, do not reorder them, and do not add
anything beyond what it lists — note extra ideas in `docs/DEFERRED.md`.
