import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import {
  ANONYMIZED_EMAIL_SUFFIX,
  DUPLICATE_THRESHOLD,
  duplicateCandidates,
  suggestDuplicates,
} from "@/features/people/duplicate-score";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  anonymizePersonAction,
  mergePeopleAction,
  reverseMergeAction,
} from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const notices: Readonly<
  Record<string, Readonly<{ text: string; ok: boolean }>>
> = {
  "merge-ok": {
    text: "Profilene er slått sammen. Handlingen kan reverseres fra historikken.",
    ok: true,
  },
  "merge-reversed": {
    text: "Sammenslåingen er reversert og de opprinnelige radene er gjenopprettet.",
    ok: true,
  },
  "merge-manual-reversal": {
    text: "Berørte rader er endret etter sammenslåingen. Ingen endringer er gjort — reverseringen må håndteres manuelt.",
    ok: false,
  },
  "merge-reason-required": {
    text: "Skriv en begrunnelse før profilene slås sammen.",
    ok: false,
  },
  "merge-target-required": {
    text: "Velg hvilken profil som skal beholdes.",
    ok: false,
  },
  "merge-already-merged": {
    text: "En av profilene inngår allerede i en aktiv sammenslåing.",
    ok: false,
  },
  "merge-course-conflict": {
    text: "Begge profilene har registrert aktivitet i samme kurs. Ingen endringer er gjort — kurset må håndteres manuelt først.",
    ok: false,
  },
  "merge-privileged": {
    text: "Profiler med administrator- eller redaktørrolle kan ikke slås sammen her.",
    ok: false,
  },
  "merge-anonymized": {
    text: "Anonymiserte profiler kan ikke inngå i en sammenslåing.",
    ok: false,
  },
  "merge-error": { text: "Sammenslåingen kunne ikke gjennomføres.", ok: false },
  "anonymize-ok": {
    text: "Deltakeren er anonymisert. Pseudonyme kursaggregater er beholdt.",
    ok: true,
  },
  "anonymize-confirm-required": {
    text: "Kryss av for å bekrefte varig anonymisering før du sender inn.",
    ok: false,
  },
  "anonymize-case-required": {
    text: "Saksreferanse er påkrevd for anonymisering.",
    ok: false,
  },
  "anonymize-approver-invalid": {
    text: "Anonymisering krever godkjenning fra en annen aktiv administrator enn både utfører og deltaker.",
    ok: false,
  },
  "anonymize-privileged": {
    text: "Deltakere med aktiv administrator- eller redaktørrolle kan ikke anonymiseres. Revoker rollene først.",
    ok: false,
  },
  "anonymize-self": {
    text: "Du kan ikke anonymisere deg selv.",
    ok: false,
  },
  "anonymize-merged-source": {
    text: "Profilen er slått sammen inn i en annen profil. Anonymiser den profilen som ble beholdt, eller reverser sammenslåingen først.",
    ok: false,
  },
  "anonymize-error": {
    text: "Anonymiseringen kunne ikke gjennomføres.",
    ok: false,
  },
};

type ProfileRow = Readonly<{
  id: string;
  display_name: string;
  normalized_email: string;
  club_name: string | null;
  phone: string | null;
}>;

type MergeRow = Readonly<{
  id: string;
  source_profile_id: string;
  target_profile_id: string;
  reason: string;
  merged_at: string;
  reversed_at: string | null;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function isAnonymized(profile: ProfileRow): boolean {
  return profile.normalized_email.endsWith(ANONYMIZED_EMAIL_SUFFIX);
}

export default async function AdminDuplicatesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ notice?: string }> }>) {
  const [query, serverClient] = await Promise.all([
    searchParams,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const admin = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, admin))) notFound();

  const [profilesResult, mergesResult, adminRolesResult, ownAccountResult] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id,display_name,normalized_email,club_name,phone")
        .order("display_name"),
      admin
        .from("person_merges")
        .select(
          "id,source_profile_id,target_profile_id,reason,merged_at,reversed_at",
        )
        .order("merged_at", { ascending: false }),
      admin
        .from("role_assignments")
        .select("profile_id,role")
        .in("role", ["administrator", "editor"])
        .is("revoked_at", null),
      admin
        .from("user_accounts")
        .select("profile_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  for (const result of [profilesResult, mergesResult, adminRolesResult]) {
    if (result.error) throw new Error("DUPLICATES_QUERY_FAILED");
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const merges = (mergesResult.data ?? []) as MergeRow[];
  const ownProfileId = (ownAccountResult.data as { profile_id: string } | null)
    ?.profile_id;

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const nameFor = (profileId: string): string =>
    profileById.get(profileId)?.display_name ?? "Ukjent profil";

  // Profiler som allerede inngår i en aktiv sammenslåing foreslås ikke på nytt.
  const activelyMergedSources = new Set(
    merges
      .filter((merge) => merge.reversed_at === null)
      .map((merge) => merge.source_profile_id),
  );
  const suggestions = suggestDuplicates(
    duplicateCandidates(profiles, activelyMergedSources),
  );

  const privilegedRoles = (adminRolesResult.data ?? []) as {
    profile_id: string;
    role: string;
  }[];
  const privilegedProfileIds = new Set(
    privilegedRoles.map((row) => row.profile_id),
  );

  // Profiler med aktiv administrator- eller redaktørrolle kan ikke
  // anonymiseres (rollene må revokeres først). Duplikat-skall som selv er
  // slått sammen inn i en annen profil tilbys heller ikke — anonymisering må
  // rettes mot den overlevende profilen, som dekker hele kjeden.
  const anonymizableProfiles = profiles.filter(
    (profile) =>
      !isAnonymized(profile) &&
      !privilegedProfileIds.has(profile.id) &&
      !activelyMergedSources.has(profile.id),
  );

  // Godkjenner: en annen aktiv administrator enn den innloggede utføreren.
  // Målet kan aldri dukke opp her — målnedtrekket utelukker administratorer,
  // og godkjennerlisten består utelukkende av administratorer.
  // Kjent restrisiko: godkjenneren autentiseres ikke med egen sesjon; ekte
  // to-personskontroll (godkjenner-innlogging) er en senere leveranse.
  const approverProfiles = privilegedRoles
    .filter((row) => row.role === "administrator")
    .map((row) => profileById.get(row.profile_id))
    .filter(
      (profile): profile is ProfileRow =>
        profile !== undefined &&
        profile.id !== ownProfileId &&
        !isAnonymized(profile),
    );

  const notice = query.notice ? notices[query.notice] : undefined;

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Administrator · deltakere</p>
        <h1>Duplikater og identitet</h1>
        <p>
          Forslagene under endrer ingenting av seg selv. Sammenslåing gjøres
          alltid manuelt, er reverserbar og logges i revisjonssporet.
        </p>
      </header>

      {notice ? (
        <p
          className={styles.notice}
          data-ok={notice.ok || undefined}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.text}
        </p>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <section aria-labelledby="suggestions-title" className={styles.card}>
            <h2 id="suggestions-title">Duplikatforslag</h2>
            {suggestions.length === 0 ? (
              <p className={styles.empty}>
                Ingen duplikatforslag nå. Nye forslag dukker opp når to profiler
                deler navn og minst ett støttesignal.
              </p>
            ) : (
              <ul className={styles.suggestionList}>
                {suggestions.map((suggestion) => {
                  const a = profileById.get(suggestion.aId);
                  const b = profileById.get(suggestion.bId);
                  if (!a || !b) return null;
                  const pairKey = `${suggestion.aId}-${suggestion.bId}`;

                  return (
                    <li className={styles.suggestion} key={pairKey}>
                      <div className={styles.suggestionHead}>
                        <span
                          aria-label={`Duplikatscore ${suggestion.score} av 100`}
                          className={styles.score}
                        >
                          ≈ {suggestion.score}
                        </span>
                        <span className={styles.signals}>
                          Signaler: {suggestion.signals.join(" + ")}
                        </span>
                      </div>
                      <div className={styles.pair}>
                        {[a, b].map((profile) => (
                          <p key={profile.id}>
                            <strong>{profile.display_name}</strong>
                            <small>
                              {profile.club_name ?? "Uten klubb"} ·{" "}
                              {profile.normalized_email}
                            </small>
                          </p>
                        ))}
                      </div>

                      <form action={mergePeopleAction}>
                        <input name="aId" type="hidden" value={a.id} />
                        <input name="bId" type="hidden" value={b.id} />
                        <fieldset className={styles.targetChoice}>
                          <legend>Hvilken profil skal beholdes?</legend>
                          {[a, b].map((profile) => (
                            <label key={profile.id}>
                              <input
                                name="targetId"
                                required
                                type="radio"
                                value={profile.id}
                              />
                              <span>
                                Behold {profile.display_name} (
                                {profile.normalized_email})
                              </span>
                            </label>
                          ))}
                        </fieldset>
                        <label htmlFor={`merge-reason-${pairKey}`}>
                          Begrunnelse
                        </label>
                        <input
                          className={styles.reasonInput}
                          id={`merge-reason-${pairKey}`}
                          name="reason"
                          placeholder="F.eks. bekreftet samme person mot Checkin"
                          required
                          type="text"
                        />
                        <p className={styles.mergeHint}>
                          Kurs der bare én av profilene har registrert
                          aktivitet, beholdes med aktiviteten. Har begge
                          aktivitet i samme kurs, stoppes sammenslåingen uten
                          endringer.
                        </p>
                        <button
                          className="nivaa-button nivaa-button--secondary"
                          type="submit"
                        >
                          Slå sammen
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-title" className={styles.card}>
            <h2 id="history-title">Sammenslåingshistorikk</h2>
            {merges.length === 0 ? (
              <p className={styles.empty}>Ingen sammenslåinger er utført.</p>
            ) : (
              <ul className={styles.historyList}>
                {merges.map((merge) => (
                  <li key={merge.id}>
                    <div>
                      <strong>
                        {nameFor(merge.source_profile_id)} →{" "}
                        {nameFor(merge.target_profile_id)}
                      </strong>
                      <small>
                        {dateFormatter.format(new Date(merge.merged_at))} ·{" "}
                        {merge.reason}
                      </small>
                      <span className={styles.historyStatus}>
                        {merge.reversed_at === null ? (
                          <>
                            <span aria-hidden="true">↔</span> Aktiv
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">⟲</span> Reversert{" "}
                            {dateFormatter.format(new Date(merge.reversed_at))}
                          </>
                        )}
                      </span>
                    </div>
                    {merge.reversed_at === null ? (
                      <form action={reverseMergeAction}>
                        <input name="mergeId" type="hidden" value={merge.id} />
                        <button
                          className="nivaa-button nivaa-button--secondary"
                          type="submit"
                        >
                          Reverser
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="anonymize-title" className={styles.card}>
            <h2 id="anonymize-title">Anonymisering (personvern)</h2>
            <div className={styles.warning} role="note">
              <strong>⚠ Kan ikke angres.</strong>
              <p>
                Anonymisering erstatter navn, e-post og telefon med varige
                plassholdere og deaktiverer innloggingene. Pseudonyme
                kursaggregater beholdes for statistikk. Flyten krever
                saksreferanse og godkjenning fra en annen administrator.
              </p>
            </div>
            <form action={anonymizePersonAction} className={styles.anonymize}>
              <label htmlFor="anonymize-profile">Deltaker</label>
              <select id="anonymize-profile" name="profileId" required>
                <option value="">Velg deltaker</option>
                {anonymizableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name} ({profile.normalized_email})
                  </option>
                ))}
              </select>

              <label htmlFor="anonymize-case">Saksreferanse</label>
              <input
                id="anonymize-case"
                name="caseReference"
                placeholder="F.eks. SAK-2026-014"
                required
                type="text"
              />

              <label htmlFor="anonymize-approver">
                Annen administrator som godkjenner
              </label>
              <select id="anonymize-approver" name="approverProfileId" required>
                <option value="">Velg administrator</option>
                {approverProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name}
                  </option>
                ))}
              </select>
              {approverProfiles.length === 0 ? (
                <p className={styles.approverHint}>
                  Ingen annen administrator er registrert. Anonymisering kan
                  ikke godkjennes før en administrator til finnes.
                </p>
              ) : null}

              <label className={styles.confirmCheck}>
                <input name="confirm" required type="checkbox" value="yes" />
                <span>
                  Jeg bekrefter varig anonymisering av valgt deltaker. Dette kan
                  ikke angres.
                </span>
              </label>

              <button
                className="nivaa-button nivaa-button--secondary"
                type="submit"
              >
                Anonymiser deltaker
              </button>
            </form>
          </section>
        </div>

        <aside className={styles.contextColumn}>
          <section aria-labelledby="definition-title" className={styles.card}>
            <h2 id="definition-title">Slik virker forslagene</h2>
            <dl className={styles.definitions}>
              <div>
                <dt>Normalisering</dt>
                <dd>
                  Navn sammenlignes uten mellomnavn og med normalisert tegnsett.
                  Telefon normaliseres til +47-format og e-post til lokaldelen.
                </dd>
              </div>
              <div>
                <dt>Minst to signaler</dt>
                <dd>
                  Et navnetreff alene er aldri nok. Forslag krever navn pluss
                  klubb, telefon eller e-postens lokaldel.
                </dd>
              </div>
              <div>
                <dt>Terskel</dt>
                <dd>
                  Par med score {DUPLICATE_THRESHOLD} eller høyere vises som
                  forslag. Ingen sammenslåing skjer automatisk.
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="status-title" className={styles.card}>
            <h2 id="status-title">Systemstatus</h2>
            <dl className={styles.statusList}>
              <div>
                <dt>Profiler</dt>
                <dd>{profiles.length}</dd>
              </div>
              <div>
                <dt>Åpne forslag</dt>
                <dd>{suggestions.length}</dd>
              </div>
              <div>
                <dt>Aktive sammenslåinger</dt>
                <dd>{activelyMergedSources.size}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
