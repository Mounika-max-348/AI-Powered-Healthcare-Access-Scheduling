---
name: Workspace build constraints
description: Environment-specific build constraints discovered while bringing the CareFlow monorepo to a clean build.
---

Generated API client code uses `Headers.entries()`, so the TypeScript library configuration must include `dom.iterable` wherever the generated client is compiled.

**Why:** The generated client typechecks differently from the app leaf packages and otherwise fails the workspace build even though the browser runtime is valid.

**How to apply:** Preserve the iterable DOM lib in shared/base configs and the generated client package config when regenerating OpenAPI outputs.

Vite artifact configs should provide non-production defaults for `PORT` and `BASE_PATH` while still honoring workflow-provided values.

**Why:** The managed workflow injects these values, but the workspace root build invokes artifact Vite configs without them; strict throws make the full build fail for an otherwise healthy artifact.

**How to apply:** Keep workflow env precedence, with safe fallback values only for local production builds.