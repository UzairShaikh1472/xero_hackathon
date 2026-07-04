/** Mirrors backend REACTIVATION_VOICE_THRESHOLD_DAYS — email below, voice agent at/above. */
export const REACTIVATION_VOICE_THRESHOLD_DAYS = 120;

export function reactivationUsesVoice(daysSilent: number): boolean {
  return daysSilent >= REACTIVATION_VOICE_THRESHOLD_DAYS;
}
