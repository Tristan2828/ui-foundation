// UI-owned types. The gateway translates every backend response into these;
// nothing above the gateway may see a wire-shaped response (the
// anti-corruption layer — docs/ARCHITECTURE.md "The layers").

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppError = {
  kind: "validation" | "notfound" | "auth" | "server" | "network";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type QuerySpec = {
  page: number;
  pageSize: number;
  sort?: { field: string; dir: "asc" | "desc" };
  filters?: Record<string, unknown>;
};
