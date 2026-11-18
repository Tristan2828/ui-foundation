// toAppError's 422 → fieldErrors keying. The key is what a form binds an
// error to: react-hook-form's field path. Written before the change that
// adds nested paths; the first four cases are today's behaviour and must
// not move.
import { describe, expect, it } from "vitest";
import { toAppError } from "../../src/api/gateway/errors";

function fieldErrorsFor(locs: (string | number)[][]) {
  const error = toAppError(422, { detail: locs.map((loc) => ({ loc, msg: `bad ${loc.join(".")}`, type: "value_error" })) });
  return error.fieldErrors;
}

describe("toAppError 422 field keys", () => {
  it("keys a plain field by its name", () => {
    expect(fieldErrorsFor([["body", "price"]])).toEqual({ price: ["bad body.price"] });
  });

  it("keys an item of a list of values by the list's name, never by position", () => {
    expect(fieldErrorsFor([["body", "tags", 0]])).toEqual({ tags: ["bad body.tags.0"] });
  });

  it("groups several items of the same list under one key", () => {
    expect(fieldErrorsFor([["body", "tags", 0], ["body", "tags", 2]])).toEqual({
      tags: ["bad body.tags.0", "bad body.tags.2"],
    });
  });

  it("keeps the last-segment key for a nested object with no list in its path", () => {
    expect(fieldErrorsFor([["body", "address", "city"]])).toEqual({ city: ["bad body.address.city"] });
  });

  it("keys a field inside a list of objects by its full form path (list.index.field)", () => {
    expect(fieldErrorsFor([["body", "checklist", 2, "text"]])).toEqual({
      "checklist.2.text": ["bad body.checklist.2.text"],
    });
  });

  it("keys the list of objects itself (too many items) by the list's name", () => {
    expect(fieldErrorsFor([["body", "checklist"]])).toEqual({ checklist: ["bad body.checklist"] });
  });
});

describe("toAppError 422 with a plain message", () => {
  it("keeps the server's sentence as the message when detail is a string (HTTPException's shape)", () => {
    expect(toAppError(422, { detail: "Only 3 widgets can be in stock at once" })).toEqual({
      kind: "validation",
      message: "Only 3 widgets can be in stock at once",
      fieldErrors: {},
    });
  });
});

// openapi/foundation.yaml's ConflictError: a 409 with HTTPErrorBody, sent
// when the record changed since the version a save was built on.
describe("toAppError 409 (ConflictError)", () => {
  it("is kind conflict, with the server's sentence as the message", () => {
    expect(toAppError(409, { detail: "This widget changed since you opened it." })).toEqual({
      kind: "conflict",
      message: "This widget changed since you opened it.",
    });
  });

  it("is conflict with no body too", () => {
    expect(toAppError(409, undefined).kind).toBe("conflict");
  });

  it("no other status is a conflict (negative control: 400, 403, 410, 412, 500)", () => {
    for (const status of [400, 403, 410, 412, 500]) {
      expect(toAppError(status, { detail: "x" }).kind).toBe("server");
    }
  });
});
