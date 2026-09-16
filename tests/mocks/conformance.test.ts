// Mock-conformance tests: load openapi.yaml directly (not schema.d.ts —
// that's TypeScript-only and vanishes at runtime) and validate every MSW
// handler's actual response body against the operation's declared response
// schema. Without this, the mocks are a second, unversioned contract that
// can silently drift from openapi.yaml. See docs/BUILD-PLAN.md
// "Verification Strategy".
import { readFileSync } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import OpenAPIResponseValidator from "openapi-response-validator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetMockData } from "../../src/mocks/data";
import { server } from "../../src/mocks/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the raw parsed spec is untyped YAML, not a generated contract type
type OpenAPIDoc = any;

const spec = loadYaml(readFileSync(path.resolve(__dirname, "../../openapi.yaml"), "utf8")) as OpenAPIDoc;

// js-yaml parses the document as plain data — it does not resolve $ref the
// way OpenAPI tooling normally does. openapi.yaml's error responses (404,
// 401, 422, 500) are declared as $ref to a shared components.responses
// entry, so that indirection has to be resolved by hand before the schema
// underneath is reachable. (Schema-level $refs, e.g. HTTPErrorBody, don't
// need this — they're passed straight through to the validator along with
// `components`, and ajv resolves those itself.)
function resolveRef(ref: string): OpenAPIDoc {
  const segments = ref.replace(/^#\//, "").split("/");
  return segments.reduce((node, segment) => node[segment], spec);
}

function validatorFor(pathKey: string, method: string): OpenAPIResponseValidator {
  const operation = spec.paths[pathKey][method];
  const responses: Record<string, { schema: unknown }> = {};
  for (const [status, defOrRef] of Object.entries(operation.responses) as [string, OpenAPIDoc][]) {
    const def = defOrRef.$ref ? resolveRef(defOrRef.$ref) : defOrRef;
    const schema = def.content?.["application/json"]?.schema;
    if (schema) responses[status] = { schema };
  }
  return new OpenAPIResponseValidator({ responses, components: spec.components });
}

async function validate(pathKey: string, method: string, res: Response) {
  if (res.status === 204) return; // openapi.yaml declares no content for 204
  const body = await res.json();
  const validator = validatorFor(pathKey, method);
  const result = validator.validateResponse(String(res.status), body);
  expect(result, JSON.stringify(result)).toBeUndefined();
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetMockData();
});
afterAll(() => server.close());

describe("MSW mock conformance", () => {
  it("GET /categories matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/categories");
    await validate("/categories", "get", res);
  });

  it("GET /widgets matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/widgets?offset=0&limit=20");
    await validate("/widgets", "get", res);
  });

  it("GET /widgets/:id matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/widgets/1");
    await validate("/widgets/{id}", "get", res);
  });

  it("GET /widgets/:id matches its 404 schema", async () => {
    const res = await fetch("http://localhost/api/widgets/9999");
    expect(res.status).toBe(404);
    await validate("/widgets/{id}", "get", res);
  });

  it("POST /widgets matches its 201 schema", async () => {
    const res = await fetch("http://localhost/api/widgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "New Widget",
        categoryId: 1,
        status: "draft",
        availableFrom: "2026-01-01T00:00:00Z",
        price: "9.99",
        description: "x",
      }),
    });
    expect(res.status).toBe(201);
    await validate("/widgets", "post", res);
  });

  it("POST /widgets matches its 422 schema on invalid input", async () => {
    const res = await fetch("http://localhost/api/widgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    await validate("/widgets", "post", res);
  });

  it("PATCH /widgets/:id matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/widgets/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(200);
    await validate("/widgets/{id}", "patch", res);
  });

  it("PATCH /widgets/:id matches its 404 schema", async () => {
    const res = await fetch("http://localhost/api/widgets/9999", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(404);
    await validate("/widgets/{id}", "patch", res);
  });

  it("DELETE /widgets/:id returns 204 with no body", async () => {
    const res = await fetch("http://localhost/api/widgets/1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /widgets/:id matches its 404 schema", async () => {
    const res = await fetch("http://localhost/api/widgets/9999", { method: "DELETE" });
    expect(res.status).toBe(404);
    await validate("/widgets/{id}", "delete", res);
  });
});
