/** Public surface of the measurement module. */

export { MEASUREMENT_ACTIVATION_APPROVED, FORMSPREE_SOURCE_FIELDS_APPROVED } from "./activation.ts";
export { resolveMeasurementConfig } from "./env.ts";
export type { MeasurementConfig, MeasurementMode } from "./env.ts";
export type { ConsentStatus } from "./consentStore.ts";
export { createMeasurementRuntime, measurement } from "./runtime.ts";
export type { HistoryAction, MeasurementRuntime, SourceSnapshot } from "./runtime.ts";
export { createInquirySubmitter, inquiryErrorMessage } from "./inquirySubmit.ts";
export { decideSourceFields, isInertFixtureEndpoint } from "./formSource.ts";
export type { SourceFieldDecision } from "./formSource.ts";
export type { InquiryOutcome, InquirySubmitter } from "./inquirySubmit.ts";
export { validateEvent, SERVICE_SLUGS, NOT_SURE_SLUG } from "./schema.ts";
export { routeLabelFor } from "./routes.ts";
export { slugForLabel } from "./services.ts";
export { classifySearch } from "./sourceInput.ts";
export {
  closeConsentUi,
  isConsentUiOpen,
  isDismissed,
  openConsentUi,
  subscribeConsentUi,
  takeInvoker,
} from "./consentUiStore.ts";
export { INQUIRY_TIMEOUT_MS, MEASUREMENT_POLICY_VERSION } from "./policy.ts";
