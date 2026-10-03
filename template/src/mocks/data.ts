// In-memory store backing the MSW handlers. Resettable so tests (and the
// mock-conformance suite) start from a known state. The signed-in user and
// the demo credentials are the foundation's (@tristan2828/ui-foundation/mocks).
import { resetMockAuth } from "@tristan2828/ui-foundation/mocks";
import type { components } from "../api/schema";

type Widget = components["schemas"]["Widget"];
type Category = components["schemas"]["Category"];

const initialCategories: Category[] = [
  { id: 1, name: "Electronics" },
  { id: 2, name: "Furniture" },
  { id: 3, name: "Stationery" },
];

const initialWidgets: Widget[] = [
  {
    id: 1,
    name: "Wireless Mouse",
    categoryId: 1,
    status: "active",
    availableFrom: "2026-01-15T00:00:00Z",
    assigneeEmail: "alice@example.com",
    price: "24.99",
    description: "A basic wireless mouse with a 2.4GHz USB receiver.",
    tags: ["fragile"],
    inStock: true,
    extraCategoryIds: [3],
    checklist: [
      { text: "Charge the battery", done: true },
      { text: "Pair the receiver", done: false },
    ],
    checklistState: "open",
  },
  {
    id: 2,
    name: "Standing Desk",
    categoryId: 2,
    status: "draft",
    availableFrom: "2026-03-01T00:00:00Z",
    assigneeEmail: null,
    price: "349.00",
    description: "Electric height-adjustable desk, 120x60cm top.",
    tags: ["bulky", "featured"],
    inStock: true,
    extraCategoryIds: [1, 3],
    checklist: [],
    checklistState: "none",
  },
  {
    id: 3,
    name: "Fountain Pen",
    categoryId: 3,
    status: "archived",
    availableFrom: "2025-06-01T00:00:00Z",
    assigneeEmail: "bob@example.com",
    price: "12.50",
    description: "Fine-nib fountain pen, discontinued.",
    tags: [],
    inStock: false,
    extraCategoryIds: [],
    checklist: [],
    checklistState: "none",
  },
  {
    // The deliberately sparse row: every optional field at its empty
    // state at once. Convention, not decoration — without one, no test
    // ever loads a record with an optional field unset, and the "empty
    // value" rendering path (an em dash in a cell, a "not set" label on a
    // form control) goes uncovered. That is exactly how a Select shipped
    // showing a raw sentinel on screen with `verify` green. Keep one of
    // these per entity; see docs/foundation/add-an-entity.md step 4.
    id: 4,
    name: "Blank Slate",
    categoryId: 1,
    status: "draft",
    availableFrom: "2025-07-01T00:00:00Z",
    assigneeEmail: null,
    price: "0.00",
    description: "Every optional field empty — the empty-state fixture.",
    tags: [],
    inStock: false,
    extraCategoryIds: [],
    checklist: [],
    checklistState: "none",
  },
];

export let categories: Category[] = structuredClone(initialCategories);
export let widgets: Widget[] = structuredClone(initialWidgets);
let nextId = widgets.length + 1;

export function resetMockData(): void {
  categories = structuredClone(initialCategories);
  widgets = structuredClone(initialWidgets);
  nextId = widgets.length + 1;
  resetMockAuth();
}

export function nextWidgetId(): number {
  return nextId++;
}
