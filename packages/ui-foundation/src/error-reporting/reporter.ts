// Error reporting in the browser (issue #126), React-free so it's tested on
// its own. FoundationProviders' `errorReporting` turns it on; off, nothing
// here runs.
//
// What it reports, each once a minute at most:
// - `route`: a screen that crashed (RouteErrorBoundary),
// - `window`: an uncaught error, `unhandledrejection`: an unhandled promise
//   rejection that isn't an AppError (those are the cache's, below),
// - `query` / `mutation`: a TanStack Query failure of kind `server`. Never
//   `auth`, `notfound`, `validation`, `rate_limited` or `network`: those are
//   expected answers or the connection, not bugs.
//
// What a report holds: the error's type, message and stack, the route
// *pattern* (`/widgets/:id`), the method and status of a failed request,
// and the release. Query strings are cut from every URL in the message and
// stack. It goes to the app's own backend (POST /client-errors), which
// adds the user from the session and forwards it; the DSN never ships in
// the bundle. Only while signed in: the endpoint needs a session.
import type { QueryClient } from "@tanstack/react-query";
import type { AppError } from "../api/contracts";
import type { ClientErrorReport } from "../api/gateway/client-errors";
import { httpStatusOf } from "../api/gateway/errors";

export type ErrorReportingOptions = {
  /** The frontend build a report names, e.g. the commit (`import.meta.env.VITE_RELEASE`). */
  release?: string;
};

export type ReportSource = ClientErrorReport["source"];

const DEDUPE_MS = 60_000;
const MAX_MESSAGE = 2000;
const MAX_STACK = 16000;
const REPORTED_KINDS: ReadonlySet<AppError["kind"]> = new Set(["server"]);

/** FoundationProviders' prop, as options, or null when reporting is off. */
export function resolveErrorReporting(option: boolean | ErrorReportingOptions | undefined): ErrorReportingOptions | null {
  if (!option) return null;
  return option === true ? {} : option;
}

// A query string or fragment in a URL or path, up to a stack frame's
// trailing :line:col (the backend's scrub, in app/error_reporting.py, is
// the same rule).
const URL_QUERY =
  /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#"'()]+|(?<![\w/])\/[^\s?#"'()]*)[?#][^\s"'()]*?(?=(?::\d+){1,2}(?=[\s"'()]|$)|[\s"'()]|$)/gi;

export function scrub(text: string, limit: number): string {
  const cut = text.replace(URL_QUERY, "$1");
  return cut.length <= limit ? cut : `${cut.slice(0, limit - 1)}…`;
}

/** `/widgets/7/edit` with `{ id: '7' }` → `/widgets/:id/edit`; a splat → `*`. */
export function routePattern(pathname: string, params: Readonly<Record<string, string | undefined>>): string {
  const named = Object.entries(params).filter(([name, value]) => name !== "*" && value);
  const splat = params["*"];
  let path = pathname;
  if (splat && path.endsWith(`/${splat}`)) path = `${path.slice(0, -splat.length)}*`;
  return path
    .split("/")
    .map((segment) => {
      const match = named.find(([, value]) => value === decodeSegment(segment));
      return match ? `:${match[0]}` : segment;
    })
    .join("/");
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isAppError(value: unknown): value is AppError {
  return typeof value === "object" && value !== null && "kind" in value && "message" in value;
}

type Described = { type: string; message: string; stack?: string };

function describe(error: unknown): Described {
  if (error instanceof Error) {
    return { type: error.name || "Error", message: error.message, stack: error.stack };
  }
  if (isAppError(error)) return { type: "ServerError", message: error.message };
  return { type: "Error", message: typeof error === "string" ? error : "A value that isn't an Error was thrown." };
}

export type ErrorReporter = {
  /** Reports `error` from `source`, unless it's a duplicate or signed out. */
  report: (source: ReportSource, error: unknown, request?: { method?: string; status?: number }) => void;
  /** The screen's route pattern, for reports that don't know theirs. */
  setRoute: (pattern: string | null) => void;
  /** Whether there's a session: the endpoint refuses without one, so nothing is sent until then. */
  setSignedIn: (signedIn: boolean) => void;
  /** Listens on the window and the query client; returns the undo. */
  install: (queryClient: QueryClient, target: Pick<EventTarget, "addEventListener" | "removeEventListener">) => () => void;
};

export function createErrorReporter({
  options,
  send,
  now = Date.now,
}: {
  options: ErrorReportingOptions;
  send: (report: ClientErrorReport) => void;
  now?: () => number;
}): ErrorReporter {
  const lastSent = new Map<string, number>();
  let route: string | null = null;
  let signedIn = false;

  const report: ErrorReporter["report"] = (source, error, request = {}) => {
    if (!signedIn) return;
    const described = describe(error);
    const message = scrub(described.message, MAX_MESSAGE);
    const signature = [source, described.type, message, route ?? ""].join("\u001f");
    const at = now();
    for (const [key, sentAt] of lastSent) if (at - sentAt >= DEDUPE_MS) lastSent.delete(key);
    if (lastSent.has(signature)) return;
    lastSent.set(signature, at);
    send({
      source,
      type: described.type.slice(0, 200),
      message,
      ...(described.stack ? { stack: scrub(described.stack, MAX_STACK) } : {}),
      ...(route ? { route } : {}),
      ...(request.method ? { method: request.method } : {}),
      ...(request.status ? { status: request.status } : {}),
      ...(options.release ? { release: options.release.slice(0, 100) } : {}),
    });
  };

  const reportAppError = (source: "query" | "mutation", error: unknown, method?: string) => {
    if (!isAppError(error) || !REPORTED_KINDS.has(error.kind)) return;
    report(source, error, { method, status: httpStatusOf(error) });
  };

  return {
    report,
    setRoute: (pattern) => {
      route = pattern;
    },
    setSignedIn: (value) => {
      signedIn = value;
    },
    install: (queryClient, target) => {
      const onError = (event: Event) => {
        const { error, message } = event as ErrorEvent;
        report("window", error ?? message);
      };
      const onRejection = (event: Event) => {
        const { reason } = event as PromiseRejectionEvent;
        // An AppError is a request's answer: the caches below report the
        // ones that are bugs, and the rest are expected.
        if (isAppError(reason)) return;
        report("unhandledrejection", reason);
      };
      target.addEventListener("error", onError);
      target.addEventListener("unhandledrejection", onRejection);
      const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "error") reportAppError("query", event.action.error, "GET");
      });
      const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "error") reportAppError("mutation", event.action.error);
      });
      return () => {
        target.removeEventListener("error", onError);
        target.removeEventListener("unhandledrejection", onRejection);
        unsubscribeQueries();
        unsubscribeMutations();
      };
    },
  };
}
