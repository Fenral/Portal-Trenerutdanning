import Link from "next/link";

import styles from "./page.module.css";

const roles = [
  {
    hole: "01",
    title: "Student",
    persona: "Selma Dahl · Trener 3",
    description:
      "Kurstidslinje, pensum, quiz, praksistimer og innlevering, helt frem til diplomet.",
    href: "/test-login?as=student-selma",
  },
  {
    hole: "02",
    title: "Kurslærer",
    persona: "Liv Trener 3 · Losby GK",
    description:
      "Hele kullet med trafikklys og filtre, vurderingskø, praksisgodkjenning og oppmøte.",
    href: "/test-login?as=teacher-t3",
  },
  {
    hole: "03",
    title: "Administrator",
    persona: "Ada Admin · NGF",
    description:
      "Driftskø, kursportefølje, tilganger, rapporter i Excel/PDF og objektivt AI-søk.",
    href: "/test-login?as=admin",
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.head}>
        <span className={styles.brand}>TRENERLØFTET / NORGES GOLFFORBUND</span>
        <span className={styles.demo}>DEMO · FIKTIVE DATA</span>
      </header>

      <div className={styles.heroRow}>
        <div className={styles.heroCell}>
          <h1>
            Test den nye trenerportalen. <em>Velg rolle.</em>
          </h1>
          <p className={styles.lede}>
            Tre roller, ett kurs. Alt du gjør skjer i et fiktivt demomiljø:
            prøv, trykk og se hva som skjer.
          </p>
        </div>
        <div className={styles.stat}>
          <b>3×</b>
          <span>Roller å utforske</span>
        </div>
      </div>

      <nav aria-label="Demo-roller">
        <ul className={styles.rows}>
          {roles.map((role) => (
            <li key={role.hole}>
              <Link className={styles.row} href={role.href}>
                <span aria-hidden="true" className={styles.hole}>
                  {role.hole}
                </span>
                <h2>
                  {role.title}
                  <small>{role.persona}</small>
                </h2>
                <p>{role.description}</p>
                <span aria-hidden="true" className={styles.go}>
                  START →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className={styles.foot}>
        Demonstrasjonsmiljø · ingen ekte persondata · tilbakemeldinger mottas
        med takk
      </p>
    </main>
  );
}
