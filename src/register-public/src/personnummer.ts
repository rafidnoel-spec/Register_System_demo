/** Snabb kontroll i webbläsaren innan formuläret skickas. Servern validerar alltid igen. */
export function isValidPersonnummer(input: string): boolean {
  const m = /^(\d{2})?(\d{2})(\d{2})(\d{2})[-+]?(\d{4})$/.exec(input.trim().replace(/\s/g, ''));
  if (!m) return false;
  const [, , yy, mm, dd, last4] = m;
  const month = Number(mm);
  let day = Number(dd);
  if (day > 60) day -= 60; // samordningsnummer
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const ten = `${yy}${mm}${dd}${last4}`;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(ten[i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Formaterar inmatning till ÅÅÅÅMMDD-XXXX medan man skriver. */
export function formatPersonnummer(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 12);
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
}
