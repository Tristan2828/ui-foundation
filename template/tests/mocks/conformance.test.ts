// Mock-conformance tests: load openapi.yaml directly (not schema.d.ts —
// that's TypeScript-only and vanishes at runtime) and validate every MSW
// handler's actual response body against the operation's declared response
// schema. Without this, the mocks are a second, unversioned contract that
// can silently drift from openapi.yaml.
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
  // OpenAPIDoc (any): the parsed YAML is untyped, same as elsewhere in this
  // file — openapi-response-validator's own Schema/SchemaObject types don't
  // line up with js-yaml's plain-object output closely enough to bother
  // narrowing here.
  const responses: Record<string, { schema: OpenAPIDoc }> = {};
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
  it("POST /auth/register matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-user@example.com", name: "New User", password: "a-strong-password" }),
    });
    expect(res.status).toBe(200);
    await validate("/auth/register", "post", res);
  });

  it("POST /auth/register matches its 422 schema on a duplicate email", async () => {
    const res = await fetch("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "dev@example.com", name: "Someone Else", password: "a-strong-password" }),
    });
    expect(res.status).toBe(422);
    await validate("/auth/register", "post", res);
  });

  it("POST /auth/login matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "dev@example.com", password: "dev-password-123" }),
    });
    expect(res.status).toBe(200);
    await validate("/auth/login", "post", res);
  });

  it("POST /auth/login matches its 401 schema on bad credentials", async () => {
    const res = await fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "dev@example.com", password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
    await validate("/auth/login", "post", res);
  });

  it("POST /auth/login matches its 202 schema for an account with a second step", async () => {
    const res = await fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "two-step@example.com", password: "dev-password-123" }),
    });
    expect(res.status).toBe(202);
    await validate("/auth/login", "post", res);
  });

  it("POST /auth/login/totp matches its 401, 200 and 410 schemas", async () => {
    const totp = (code: string) =>
      fetch("http://localhost/api/auth/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
    await fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "two-step@example.com", password: "dev-password-123" }),
    });
    const wrong = await totp("000000");
    expect(wrong.status).toBe(401);
    await validate("/auth/login/totp", "post", wrong);
    const right = await totp("123456");
    expect(right.status).toBe(200);
    await validate("/auth/login/totp", "post", right);
    const gone = await totp("123456");
    expect(gone.status).toBe(410);
    await validate("/auth/login/totp", "post", gone);
  });

  it("POST /client-errors answers 204 signed in, and its 401 schema signed out", async () => {
    const send = () =>
      fetch("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "window", type: "TypeError", message: "boom", route: "/widgets/:id" }),
      });
    expect((await send()).status).toBe(204);
    await fetch("http://localhost/api/auth/logout", { method: "POST" });
    const refused = await send();
    expect(refused.status).toBe(401);
    await validate("/client-errors", "post", refused);
  });

  it("/push/* match their schemas: the key, a device saved once, deleted once", async () => {
    const key = await fetch("http://localhost/api/push/public-key");
    expect(key.status).toBe(200);
    await validate("/push/public-key", "get", key);
    const subscribe = () =>
      fetch("http://localhost/api/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/a", keys: { p256dh: "k", auth: "a" } }),
      });
    const first = await subscribe();
    expect(first.status).toBe(201);
    const { id } = await first.clone().json();
    await validate("/push/subscriptions", "post", first);
    expect(await (await subscribe()).json()).toEqual({ id });
    expect((await fetch(`http://localhost/api/push/subscriptions/${id}`, { method: "DELETE" })).status).toBe(204);
    const gone = await fetch(`http://localhost/api/push/subscriptions/${id}`, { method: "DELETE" });
    expect(gone.status).toBe(404);
    await validate("/push/subscriptions/{id}", "delete", gone);
  });

  it("GET /auth/me matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/auth/me");
    expect(res.status).toBe(200);
    await validate("/auth/me", "get", res);
  });

  it("POST /auth/logout returns 204, then GET /auth/me matches its 401 schema", async () => {
    const logoutRes = await fetch("http://localhost/api/auth/logout", { method: "POST" });
    expect(logoutRes.status).toBe(204);

    const meRes = await fetch("http://localhost/api/auth/me");
    expect(meRes.status).toBe(401);
    await validate("/auth/me", "get", meRes);
  });

  it("GET /environment matches its 200 schema, with no data label in mock mode", async () => {
    const res = await fetch("http://localhost/api/environment");
    expect(res.status).toBe(200);
    expect(await res.clone().json()).toEqual({ dataLabel: null });
    await validate("/environment", "get", res);
  });

  it("GET /widget-categories matches its 200 schema", async () => {
    const res = await fetch("http://localhost/api/widget-categories");
    await validate("/widget-categories", "get", res);
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

  // The backend's rules too (tests/test_widgets.py), so the two agree.
  it.each(["name", "categoryId", "status", "availableFrom", "price", "description", "tags", "inStock", "extraCategoryIds", "checklist", "pairings"])(
    "PATCH /widgets/:id with %s: null is a 422 on that field",
    async (field) => {
      const res = await fetch("http://localhost/api/widgets/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: null }),
      });
      expect(res.status).toBe(422);
      const body = await res.clone().json();
      expect(body.detail.map((issue: { loc: unknown }) => issue.loc)).toEqual([["body", field]]);
      await validate("/widgets/{id}", "patch", res);
    },
  );

  // Sub-records with a reference (openapi.yaml pairings): kept in order,
  // notes trimmed, and an unknown category refused at the item's own path.
  it("PATCH /widgets/:id keeps pairings in order and refuses an unknown category at its item", async () => {
    const saved = await fetch("http://localhost/api/widgets/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairings: [{ categoryId: 2, note: " Spare " }, { categoryId: 1, note: "" }] }),
    });
    expect(saved.status).toBe(200);
    expect((await saved.clone().json()).pairings).toEqual([
      { categoryId: 2, note: "Spare" },
      { categoryId: 1, note: "" },
    ]);
    await validate("/widgets/{id}", "patch", saved);

    const refused = await fetch("http://localhost/api/widgets/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairings: [{ categoryId: 1, note: "" }, { categoryId: 999, note: "" }] }),
    });
    expect(refused.status).toBe(422);
    const body = await refused.clone().json();
    expect(body.detail.map((issue: { loc: unknown }) => issue.loc)).toEqual([["body", "pairings", 1, "categoryId"]]);
    await validate("/widgets/{id}", "patch", refused);
  });

  it("PATCH /widgets/:id with assigneeEmail: null clears it", async () => {
    const res = await fetch("http://localhost/api/widgets/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assigneeEmail: null }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).assigneeEmail).toBeNull();
  });

  it.each([null, "status:asc", "status:desc"])("GET /widgets sorted by %s orders ties by id", async (sort) => {
    const res = await fetch(`http://localhost/api/widgets?limit=100${sort ? `&sort=${sort}` : ""}`);
    const { items } = (await res.json()) as { items: { id: number; status: string }[] };
    const sign = sort === "status:desc" ? -1 : 1;
    for (let i = 1; i < items.length; i++) {
      const [a, b] = [items[i - 1], items[i]];
      const byStatus = sort ? sign * a.status.localeCompare(b.status) : 0;
      expect(byStatus < 0 || (byStatus === 0 && a.id < b.id), `${a.id} before ${b.id}`).toBe(true);
    }
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

  it("a deleted widget leaves the list and is listed by deleted=true; restore brings it back", async () => {
    await fetch("http://localhost/api/widgets/1", { method: "DELETE" });
    expect((await fetch("http://localhost/api/widgets/1")).status).toBe(404);
    const live = await (await fetch("http://localhost/api/widgets")).json();
    expect(live.items.some((w: { id: number }) => w.id === 1)).toBe(false);
    const trash = await (await fetch("http://localhost/api/widgets?deleted=true")).json();
    expect(trash.items.map((w: { id: number }) => w.id)).toEqual([1]);

    const res = await fetch("http://localhost/api/widgets/1/restore", { method: "POST" });
    expect(res.status).toBe(200);
    await validate("/widgets/{id}/restore", "post", res);
    expect((await fetch("http://localhost/api/widgets/1")).status).toBe(200);
  });

  it("POST /widgets/:id/restore matches its 404 schema for a widget that is not deleted", async () => {
    const res = await fetch("http://localhost/api/widgets/1/restore", { method: "POST" });
    expect(res.status).toBe(404);
    await validate("/widgets/{id}/restore", "post", res);
  });
});
