// In-memory store backing the MSW handlers. Resettable so tests (and the
// mock-conformance suite) start from a known state.
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
  },
];

export let categories: Category[] = structuredClone(initialCategories);
export let widgets: Widget[] = structuredClone(initialWidgets);
let nextId = widgets.length + 1;

export function resetMockData(): void {
  categories = structuredClone(initialCategories);
  widgets = structuredClone(initialWidgets);
  nextId = widgets.length + 1;
}

export function nextWidgetId(): number {
  return nextId++;
}
