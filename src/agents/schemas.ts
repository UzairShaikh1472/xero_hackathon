import { z } from "zod";

/**
 * Fields the LLM is allowed to produce.
 * Identity, money, urgency, proposedAction, and reason are always set from scored inputs.
 */
export const DraftPartialSchema = z.object({
  draftMessage: z
    .string()
    .describe(
      "Professional message ready to send. Use only the facts provided; do not invent amounts, dates, or contacts.",
    ),
  confidenceLevel: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the draft quality from 0 to 1."),
});

export type DraftPartial = z.infer<typeof DraftPartialSchema>;
