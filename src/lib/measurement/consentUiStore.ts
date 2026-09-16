/**
 * Tiny store for the consent panel's open state, so the persistent footer
 * "Analytics preferences" control can reopen the notice without threading state
 * through the whole tree. Holds no consent decision and no visitor data.
 */

type Listener = () => void;

let open = false;
let dismissedThisDocument = false;
let invoker: HTMLElement | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeConsentUi(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isConsentUiOpen(): boolean {
  return open;
}

/** True once the visitor dismissed the first-visit notice in this document. */
export function isDismissed(): boolean {
  return dismissedThisDocument;
}

/** Opens the panel. `element` is focused again when the panel closes. */
export function openConsentUi(element?: HTMLElement | null): void {
  invoker = element ?? null;
  open = true;
  notify();
}

/** Closes the panel. Dismissal never grants consent. */
export function closeConsentUi(options: { dismissed?: boolean } = {}): void {
  open = false;
  if (options.dismissed) dismissedThisDocument = true;
  notify();
}

export function takeInvoker(): HTMLElement | null {
  const element = invoker;
  invoker = null;
  return element;
}
