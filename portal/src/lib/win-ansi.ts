/**
 * pdf-lib med StandardFonts.Helvetica koder tekst som WinAnsi (CP1252) og
 * kaster på alt annet – inkludert linjeskift. Denne sanitizeren gjør vilkårlig
 * DB-tekst trygg å tegne: NFC-normaliser, kollaps whitespace, translitterer
 * kjente latinske bokstaver utenfor CP1252 (polsk/samisk) og erstatt resten
 * med "?".
 */

// Kodepunkter i CP1252 utenfor Latin-1-området (0x80–0x9F-blokken).
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

// Latinske bokstaver uten dekomponerbar diakritikk som CP1252 mangler.
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  Đ: "D",
  đ: "d",
  Ħ: "H",
  ħ: "h",
  Ł: "L",
  ł: "l",
  Ŋ: "N",
  ŋ: "n",
  Ŧ: "T",
  ŧ: "t",
};

const COMBINING_MARKS = /[̀-ͯ]/g;

function isEncodable(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.includes(character)
  );
}

export function winAnsiSafe(value: string): string {
  const collapsed = value.normalize("NFC").replace(/\s+/g, " ").trim();
  let result = "";
  for (const character of collapsed) {
    if (isEncodable(character)) {
      result += character;
      continue;
    }
    const mapped = TRANSLITERATIONS[character];
    if (mapped) {
      result += mapped;
      continue;
    }
    const stripped = character
      .normalize("NFD")
      .replace(COMBINING_MARKS, "")
      .normalize("NFC");
    result +=
      stripped !== character && [...stripped].every(isEncodable)
        ? stripped
        : "?";
  }
  return result;
}
