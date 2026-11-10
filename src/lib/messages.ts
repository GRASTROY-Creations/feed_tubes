/**
 * Runtime message protocol between the sidebar and the background script.
 * Requests go sidebar → background and get a typed response; events go background → sidebar.
 */
import { isRecord } from "./guards.js";
import type { LocalizedText } from "./i18n/index.js";
import type { RefreshSummary } from "./refresh.js";

export type RefreshReason = "manual" | "alarm";

/** Errors cross extension contexts untranslated; the sidebar translates them when shown. */
export type Result<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: LocalizedText };

/** Each request type and the response the background sends back. */
export interface RequestResponses {
  "refresh-request": Result<RefreshSummary>;
  "settings-changed": Result;
  "alarm-info": Result<{ alarm: browser.alarms.Alarm | null }>;
}

export type RequestType = keyof RequestResponses;

export interface Request<T extends RequestType = RequestType> {
  type: T;
}

const REQUEST_TYPES: readonly RequestType[] = ["refresh-request", "settings-changed", "alarm-info"];

export function isRequest(message: unknown): message is Request {
  return isRecord(message) && REQUEST_TYPES.includes(message.type as RequestType);
}

/** Sends a request to the background script and resolves with its typed response. */
export async function sendRequest<T extends RequestType>(type: T): Promise<RequestResponses[T]> {
  const request: Request<T> = { type };
  return (await browser.runtime.sendMessage(request)) as RequestResponses[T];
}

export interface FeedUpdatedEvent {
  type: "feed-updated";
  reason: RefreshReason;
  total?: number;
  failures?: number;
  error?: LocalizedText;
}

export function isFeedUpdatedEvent(message: unknown): message is FeedUpdatedEvent {
  return isRecord(message) && message.type === "feed-updated";
}

/** Broadcasts an event to open sidebars; resolves quietly when none is listening. */
export async function broadcast(event: FeedUpdatedEvent): Promise<void> {
  try {
    await browser.runtime.sendMessage(event);
  } catch {
    // No sidebar is open to receive the event.
  }
}
