import type { NegotiationDraft, Urgency } from "../types/financial.js";
import { getAgentResponse } from "../lib/llm.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { DraftPartialSchema, type DraftPartial } from "./schemas.js";

export interface ScoredDraftFacts {
  targetType: NegotiationDraft["targetType"];
  contactName: string;
  urgency: Urgency;
  proposedAction: string;
  expectedCashImpact: number;
  /** Deterministic "Why this action?" — never from the LLM. */
  reason: string;
}

/**
 * Call the AI layer for prose only, then merge with scored facts.
 * Identity, money, urgency, proposedAction, and reason always come from `facts`.
 */
export async function composeNegotiationDraft(
  userPrompt: string,
  facts: ScoredDraftFacts,
): Promise<NegotiationDraft> {
  const raw = await getAgentResponse(SYSTEM_PROMPT, userPrompt);
  // Tolerate older models that still emit `reason` — we ignore it.
  const partial = DraftPartialSchema.passthrough().parse(raw);
  return mergeDraft(facts, {
    draftMessage: partial.draftMessage,
    confidenceLevel: partial.confidenceLevel,
  });
}

function mergeDraft(
  facts: ScoredDraftFacts,
  partial: DraftPartial,
): NegotiationDraft {
  return {
    targetType: facts.targetType,
    contactName: facts.contactName,
    urgency: facts.urgency,
    proposedAction: facts.proposedAction,
    expectedCashImpact: facts.expectedCashImpact,
    reason: facts.reason,
    draftMessage: partial.draftMessage,
    confidenceLevel: partial.confidenceLevel,
  };
}
