/**
 * Client acknowledgements for 18+ / Terms (localStorage only).
 * Not a substitute for operator legal review.
 */

const AGE_KEY = "sofiaore_age_ok_v1";
const TERMS_KEY = "sofiaore_terms_ok_v1";

export function hasAgeAck(): boolean {
  try {
    return localStorage.getItem(AGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasTermsAck(): boolean {
  try {
    return localStorage.getItem(TERMS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAgeAck(ok: boolean) {
  try {
    if (ok) localStorage.setItem(AGE_KEY, "1");
    else localStorage.removeItem(AGE_KEY);
  } catch {
    /* ignore */
  }
}

export function setTermsAck(ok: boolean) {
  try {
    if (ok) localStorage.setItem(TERMS_KEY, "1");
    else localStorage.removeItem(TERMS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPlayComplianceAck(): boolean {
  return hasAgeAck() && hasTermsAck();
}

export function setPlayComplianceAck() {
  setAgeAck(true);
  setTermsAck(true);
}
