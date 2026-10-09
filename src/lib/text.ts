// Control characters and bidi overrides can disguise text; strip them from untrusted strings.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

/** Untrusted on-chain text (token names, symbols) made safe for display. React escapes HTML; this removes invisible/bidi tricks and caps length. */
export function safeText(value: string | null | undefined, max = 64): string {
  if (!value) return "";
  const clean = value.replace(UNSAFE, "").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
