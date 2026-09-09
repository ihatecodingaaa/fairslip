import type { Key } from "@/lib/i18n";

/**
 * The engine's reason codes, read aloud.
 *
 * THE KEYS ARE THE ENGINE'S OWN ENUM, and the code itself is shown beside the
 * sentence everywhere this map is used - so nothing here REPLACES what the
 * engine said, it only says it in words and in the reader's language.
 *
 * ONE MAP, NOT ONE PER SCREEN. The reason lens, the row inspector, the row lists
 * and every exported report read this. Two copies would drift, and a payroll
 * report whose sentence for AGE_BAND_MISSED differs from the screen's is two
 * accounts of one finding.
 *
 * backend/tests/test_employer_ui.py asserts this covers every member of
 * fairslip.employer.Reason - derived from the enum, not from a list written
 * twice - so a new reason code cannot reach a screen with no words for it.
 */
export const REASON_WORDS: Record<string, Key> = {
  AMOUNT_MISMATCH: "employer.reasonAmountMismatch",
  AGE_BAND_MISSED: "employer.reasonAgeBand",
  OW_ABOVE_CEILING: "employer.reasonCeiling",
  NOT_A_CPF_MEMBER: "employer.reasonNotMember",
  ENGINE_REFUSED: "employer.reasonEngineRefused",
  ADDITIONAL_WAGES_PRESENT: "employer.reasonAdditionalWages",
  UNREADABLE_ROW: "employer.reasonUnreadable",
};
