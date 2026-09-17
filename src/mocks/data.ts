// In-memory store backing the MSW handlers. Resettable so tests (and the
// mock-conformance suite) start from a known state.
import type { components } from "../api/schema";

type Widget = components["schemas"]["Widget"];
type Category = components["schemas"]["Category"];
type User = components["schemas"]["User"];

// Same demo credentials as the real backend's seeded dev user
// (backend/app/config.py's SEED_USER_EMAIL/SEED_USER_PASSWORD defaults) —
// keeps "log in" behave identically whether MSW or the real API answers.
export const mockUser: User = { id: 1, email: "dev@example.com", name: "Dev User" };
export const MOCK_PASSWORD = "dev-password-123";

// Defaults to true: every existing widgets/shell spec and Storybook story
// predates Phase 10 and assumes access, and MSW (not a real cookie) is what
// those runs treat as ground truth. e2e/auth.spec.ts is what actually
// exercises the false path, via a runtime override — see e2e/e2e-hooks.ts.
export let isAuthenticated = true;

export function setAuthenticated(value: boolean): void {
  isAuthenticated = value;
}

// Registration store (Phase 11) — mirrors the real backend's email-
// uniqueness check (User.email is a unique column) and its "auto-login"
// behavior (a new registration becomes the session's current user, same as
// backend/app/routers/auth.py's shared _start_session path). Starts with
// just the seeded dev user's email taken.
let registeredUsers = new Map<string, User>([[mockUser.email, mockUser]]);
let currentUser: User = mockUser;
let nextUserId = 2;

export function isEmailRegistered(email: string): boolean {
  return registeredUsers.has(email);
}

export function registerMockUser(email: string, name: string): User {
  const user: User = { id: nextUserId++, email, name };
  registeredUsers.set(email, user);
  currentUser = user;
  return user;
}

export function getCurrentMockUser(): User {
  return currentUser;
}

export function setCurrentMockUser(user: User): void {
  currentUser = user;
}

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
  isAuthenticated = true;
  registeredUsers = new Map([[mockUser.email, mockUser]]);
  currentUser = mockUser;
  nextUserId = 2;
}

export function nextWidgetId(): number {
  return nextId++;
}
