/**
 * Inquiry request lifecycle.
 *
 * Extracted from the component so the races that matter can be tested with a
 * fake clock and a fake fetch: a synchronous in-flight latch that survives a
 * re-render, a bounded timeout with abort, exactly one settled outcome per
 * client operation, and a late callback from an abandoned request being
 * ignored.
 *
 * Deliberately not claimed: backend exactly-once delivery. A timed-out request
 * may still have reached the server, so nothing here retries on its own.
 */

import { INQUIRY_TIMEOUT_MS } from "./policy.ts";

export type InquiryOutcomeStatus = "accepted" | "rejected" | "network" | "timeout" | "duplicate";

export type InquiryOutcome = {
  status: InquiryOutcomeStatus;
  /** Stable id for the client operation. Empty for an ignored duplicate. */
  operationId: string;
  message?: string;
};

export type InquirySubmitterOptions = {
  endpoint: string;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
  setTimeoutImpl?: (handler: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
};

export type InquirySubmitter = {
  isInFlight: () => boolean;
  submit: (payload: Record<string, string>) => Promise<InquiryOutcome>;
};

/** Distinguishes operations from different submitter instances in one document. */
let instanceCount = 0;

export function createInquirySubmitter(options: InquirySubmitterOptions): InquirySubmitter {
  const instance = (instanceCount += 1);
  const timeoutMs = options.timeoutMs ?? INQUIRY_TIMEOUT_MS;
  const startTimer = options.setTimeoutImpl ?? ((handler, ms) => setTimeout(handler, ms));
  const stopTimer = options.clearTimeoutImpl ?? ((handle) => clearTimeout(handle as never));

  // Synchronous latch. Set before any await, so rapid submit/Enter/callback
  // paths and re-renders cannot start a second POST for the same operation.
  let inFlight = false;
  let sequence = 0;

  async function submit(payload: Record<string, string>): Promise<InquiryOutcome> {
    if (inFlight) return { status: "duplicate", operationId: "" };
    inFlight = true;
    sequence += 1;
    const operationId = "inquiry-" + instance + "-" + sequence;

    const controller = new AbortController();
    let timedOut = false;
    const timer = startTimer(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await options.fetchImpl(options.endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      // A response that arrives after the abort belongs to an abandoned
      // operation and is ignored rather than reported as acceptance.
      if (timedOut) return { status: "timeout", operationId };
      if (response.ok) return { status: "accepted", operationId };
      return {
        status: "rejected",
        operationId,
        message: "Server responded with " + response.status,
      };
    } catch (error) {
      if (timedOut) return { status: "timeout", operationId };
      return {
        status: "network",
        operationId,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong. Try again or email us directly.",
      };
    } finally {
      stopTimer(timer);
      inFlight = false;
    }
  }

  return { isInFlight: () => inFlight, submit };
}

/** Visitor-facing copy for a settled failure. Never echoes response bodies. */
export function inquiryErrorMessage(outcome: InquiryOutcome): string {
  if (outcome.status === "timeout") {
    return "That took too long, so we stopped waiting. Your details are still here - please try again, or email us directly.";
  }
  return outcome.message ?? "Something went wrong. Try again or email us directly.";
}
