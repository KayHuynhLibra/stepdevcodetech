/**
 * Client acknowledgements for 18+ / Terms (localStorage only).
 * Not a substitute for operator legal review.
 */

import { brandLsGet, brandLsRemove, brandLsSet } from "./brand";

const AGE_KEY = "sofia_age_ok_v2";
const TERMS_KEY = "sofia_terms_ok_v6";

export function hasAgeAck(): boolean {
  return brandLsGet(AGE_KEY) === "1";
}

export function hasTermsAck(): boolean {
  return brandLsGet(TERMS_KEY) === "1";
}

export function setAgeAck(ok: boolean) {
  if (ok) brandLsSet(AGE_KEY, "1");
  else brandLsRemove(AGE_KEY);
}

export function setTermsAck(ok: boolean) {
  if (ok) brandLsSet(TERMS_KEY, "1");
  else brandLsRemove(TERMS_KEY);
}

export function hasPlayComplianceAck(): boolean {
  return hasAgeAck() && hasTermsAck();
}

export function setPlayComplianceAck() {
  setAgeAck(true);
  setTermsAck(true);
}
