// Guards registry.json's `starter` item against a bug found in audit Phase
// A: `starter` used to pull `conventions`/`theme` through
// registryDependencies with no ref, so a consumer pinned to `starter#v1.x`
// silently got AGENTS.md, the playbook, eslint.config.js and the theme CSS
// from `main` instead. `starter` must be self-contained; the two smaller
// items stay only for standalone installs, and must not drift from it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type RegistryFile = { path: string; target: string };
type RegistryItem = {
  name: string;
  files: RegistryFile[];
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
};

const registry = JSON.parse(readFileSync("registry.json", "utf8")) as { items: RegistryItem[] };
const item = (name: string) => registry.items.find((i) => i.name === name)!;
const starter = item("starter");
const bareName = (dep: string) => dep.replace(/(.)@.*$/, "$1");

describe("registry.json starter item", () => {
  it("does not depend on this registry's own items (an unpinned dependency resolves to main)", () => {
    const own = (starter.registryDependencies ?? []).filter((dep) => dep.includes("/"));
    expect(own).toEqual([]);
  });

  for (const name of ["conventions", "theme"]) {
    it(`ships every file and dependency the ${name} item does`, () => {
      const other = item(name);
      const starterFiles = starter.files.map((f) => `${f.path} -> ${f.target}`);
      for (const f of other.files) {
        expect(starterFiles).toContain(`${f.path} -> ${f.target}`);
      }
      const starterDeps = [...(starter.dependencies ?? []), ...(starter.devDependencies ?? [])].map(bareName);
      for (const dep of [...(other.dependencies ?? []), ...(other.devDependencies ?? [])]) {
        expect(starterDeps).toContain(bareName(dep));
      }
    });
  }
});
