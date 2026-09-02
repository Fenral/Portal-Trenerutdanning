/**
 * Duplikatforslag for deltakerprofiler.
 *
 * Ren scoring uten sideeffekter: et forslag endrer aldri bruker- eller
 * kursdata, og sammenslåing skjer kun manuelt av administrator.
 * Score krever minst to signaler (navn kan aldri nå terskelen alene).
 */

export const DUPLICATE_THRESHOLD = 80;

// Navn er grunnsignalet; hvert støttesignal løfter paret over terskelen.
const NAME_WEIGHT = 50;
const SUPPORT_WEIGHT = 30;

export type DuplicateCandidate = Readonly<{
  name: string;
  club: string | null;
  email: string | null;
  phone: string | null;
}>;

export type DuplicateProfile = DuplicateCandidate & Readonly<{ id: string }>;

export type DuplicateSignal = "navn" | "klubb" | "telefon" | "epost";

export type DuplicateSuggestion = Readonly<{
  aId: string;
  bId: string;
  score: number;
  signals: readonly DuplicateSignal[];
}>;

/**
 * NFKC, små bokstaver, kollapset mellomrom — og mellomnavn fjernes slik at
 * «Nora K Vik» og «Nora Vik» normaliseres likt (første + siste navneledd).
 */
export function normalizeName(name: string): string {
  const tokens = name
    .normalize("NFKC")
    .toLocaleLowerCase("nb-NO")
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length <= 1) return tokens.join(" ");
  return `${tokens[0]} ${tokens[tokens.length - 1]}`;
}

/** E.164 med norsk +47 som standard for åttesifrede nasjonale numre. */
export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.normalize("NFKC").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (/^\d{8}$/.test(digits)) return `+47${digits}`;
  return `+${digits}`;
}

export function normalizeEmailLocalPart(email: string | null): string | null {
  if (!email) return null;
  const localPart = email.normalize("NFKC").trim().toLowerCase().split("@")[0];
  return localPart || null;
}

function normalizeClub(club: string | null): string | null {
  if (!club) return null;
  const normalized = club
    .normalize("NFKC")
    .toLocaleLowerCase("nb-NO")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

function bothEqual(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}

export function duplicateSignals(
  a: DuplicateCandidate,
  b: DuplicateCandidate,
): readonly DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];
  if (normalizeName(a.name) === normalizeName(b.name)) signals.push("navn");
  if (bothEqual(normalizeClub(a.club), normalizeClub(b.club)))
    signals.push("klubb");
  if (bothEqual(normalizePhone(a.phone), normalizePhone(b.phone)))
    signals.push("telefon");
  if (
    bothEqual(
      normalizeEmailLocalPart(a.email),
      normalizeEmailLocalPart(b.email),
    )
  )
    signals.push("epost");
  return signals;
}

export function duplicateScore(
  a: DuplicateCandidate,
  b: DuplicateCandidate,
): number {
  const signals = duplicateSignals(a, b);
  // Minst to signaler: uten navnetreff teller støttesignaler ikke som duplikat.
  if (!signals.includes("navn")) return 0;
  const supportCount = signals.length - 1;
  return Math.min(100, NAME_WEIGHT + supportCount * SUPPORT_WEIGHT);
}

/**
 * Scorer alle profilpar.
 * ponytail: O(n²) parvis sammenligning — greit for demo-skala (<1k profiler);
 * bytt til blocking på normalisert etternavn hvis datamengden vokser.
 */
export function suggestDuplicates(
  profiles: readonly DuplicateProfile[],
): readonly DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      const score = duplicateScore(a, b);
      if (score >= DUPLICATE_THRESHOLD) {
        suggestions.push({
          aId: a.id,
          bId: b.id,
          score,
          signals: duplicateSignals(a, b),
        });
      }
    }
  }
  return suggestions.sort((left, right) => right.score - left.score);
}
