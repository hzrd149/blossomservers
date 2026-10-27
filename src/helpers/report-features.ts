import { Capability } from "./report";

/** Describe policies and features without implying that either choice is good or bad. */
export const REPORT_FEATURE_LABELS: Record<Capability, { yes: string; no: string }> = {
  upload: { yes: "Uploads", no: "No uploads" },
  mirror: { yes: "Mirroring", no: "No mirroring" },
  media: { yes: "Media optimization", no: "No media optimization" },
  "upload-auth": { yes: "Auth required", no: "No auth required" },
  "upload-payment": { yes: "Paid uploads", no: "Free uploads" },
  "restricted-uploads": { yes: "Restricted uploads", no: "Public uploads" },
};
