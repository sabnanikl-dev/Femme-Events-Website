/**
 * The measurement allowlist. Every event that leaves the wrapper is validated
 * here first: an unknown event name, an extra key, a missing required key or an
 * unlisted value rejects the payload **as a whole**. Rejected payloads are
 * never logged — the point of the allowlist is that unexpected content does not
 * get recorded anywhere, including the console.
 *
 * Callers may not inject `source`/`medium`/`campaign`. Those are attached by
 * the runtime from validated, consent-approved source state only.
 */

import { SERVICE_OPTIONS } from "../../data/serviceOptions.ts";

export const NOT_SURE_SLUG = "not-sure";

/** Canonical package slugs plus the neutral fallback. */
export const SERVICE_SLUGS: readonly string[] = [
  ...SERVICE_OPTIONS.map((option) => option.slug),
  NOT_SURE_SLUG,
];

export const SOURCE_PARAM_KEYS = ["source", "medium", "campaign"] as const;

type ParamRule = {
  required: boolean;
  values: readonly string[];
  /** When set, the key is only allowed if `location` equals this value. */
  onlyWithLocation?: string;
};

type EventRule = Record<string, ParamRule>;

const CTA_LOCATIONS = ["hero", "service_card", "process", "vendors", "faq"] as const;

/**
 * The complete runtime allowlist. Adding a callsite does not widen it; a new
 * event requires a policy decision and an explicit entry here.
 */
export const EVENT_ALLOWLIST: Readonly<Record<string, EventRule>> = {
  inquiry_submit: {
    location: { required: true, values: ["inquiry_form"] },
    service: { required: true, values: SERVICE_SLUGS },
  },
  phone_click: {
    location: { required: true, values: ["footer"] },
  },
  email_click: {
    location: { required: true, values: ["footer"] },
  },
  cta_inquiry_click: {
    location: { required: true, values: CTA_LOCATIONS },
    service: { required: false, values: SERVICE_SLUGS, onlyWithLocation: "service_card" },
  },
};

export type EventParams = Record<string, string>;

export type ValidatedEvent = { name: string; params: EventParams };

/**
 * Validates an event against the allowlist.
 *
 * @returns the validated event, or `null` if anything about it is unexpected.
 */
export function validateEvent(name: unknown, params: unknown): ValidatedEvent | null {
  if (typeof name !== "string") return null;
  const rule = Object.prototype.hasOwnProperty.call(EVENT_ALLOWLIST, name)
    ? EVENT_ALLOWLIST[name]
    : undefined;
  if (!rule) return null;

  if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
    return null;
  }
  const input = (params ?? {}) as Record<string, unknown>;
  const keys = Object.keys(input);

  // No unknown keys, and never a caller-supplied source tuple.
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(rule, key)) return null;
  }

  const location = input.location;
  const validated: EventParams = {};

  for (const [key, paramRule] of Object.entries(rule)) {
    const value = input[key];
    if (value === undefined) {
      if (paramRule.required) return null;
      continue;
    }
    if (typeof value !== "string") return null;
    if (!paramRule.values.includes(value)) return null;
    if (paramRule.onlyWithLocation !== undefined && location !== paramRule.onlyWithLocation) {
      return null;
    }
    validated[key] = value;
  }

  return { name, params: validated };
}
