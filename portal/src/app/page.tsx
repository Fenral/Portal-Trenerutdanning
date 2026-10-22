import Link from "next/link";

import styles from "./page.module.css";

const roles = [
  {
    id: "student",
    title: "Student",
    description:
      "Kurstidslinje, pensum, quiz, praksistimer og innlevering frem til diplomet.",
    href: "/test-login?as=student-selma",
  },
  {
    id: "teacher",
    title: "Kurslærer",
    description:
      "Hele kullet med trafikklys, vurderingskø, praksisgodkjenning og oppmøte.",
    href: "/test-login?as=teacher-t3",
  },
  {
    id: "admin",
    title: "Administrator",
    description: "Driftskø, kursportefølje, tilganger og rapporter.",
    href: "/test-login?as=admin",
  },
] as const;

function StudentScreen() {
  return (
    <>
      <div className={styles.bar}>
        <span>Selma Dahl</span>
        <span className={`${styles.lvl} ${styles.t3}`}>Trener 3</span>
      </div>
      <div>Modul 4 · Teknikk</div>
      <div className={styles.prog}>
        <i />
      </div>
      <div className={styles.tl}>
        <div className={styles.row}>
          <span className={`${styles.dot} ${styles.ok}`} />
          <span className={styles.grow}>Pensum: D-plane</span>
          <span className={styles.muted}>lest</span>
        </div>
        <div className={styles.row}>
          <span className={`${styles.dot} ${styles.ok}`} />
          <span className={styles.grow}>Quiz 4.1</span>
          <span className={styles.muted}>9/10</span>
        </div>
        <div className={styles.row}>
          <span className={`${styles.dot} ${styles.warn}`} />
          <span className={styles.grow}>Praksistime 3</span>
          <span className={styles.muted}>i dag</span>
        </div>
        <div className={styles.row}>
          <span className={`${styles.dot} ${styles.idle}`} />
          <span className={styles.grow}>Innlevering</span>
          <span className={styles.muted}>7 d</span>
        </div>
      </div>
      <span className={styles.btn}>Fortsett</span>
    </>
  );
}

function TeacherScreen() {
  const students = [
    ["ok", "Selma D.", "92 %"],
    ["ok", "Jonas H.", "88 %"],
    ["warn", "Mari L.", "61 %"],
    ["bad", "Erik S.", "fravær"],
    ["ok", "Nora K.", "95 %"],
  ] as const;
  return (
    <>
      <div className={styles.bar}>
        <span>Kull T3 · Losby</span>
        <span className={`${styles.lvl} ${styles.t3}`}>14 stud.</span>
      </div>
      <div className={styles.kpi}>
        <div>
          <b>9</b>på plan
        </div>
        <div>
          <b>3</b>til vurdering
        </div>
      </div>
      {students.map(([state, name, value]) => (
        <div className={styles.row} key={name}>
          <span className={`${styles.dot} ${styles[state]}`} />
          <span className={styles.grow}>{name}</span>
          <span className={styles.muted}>{value}</span>
        </div>
      ))}
      <span className={styles.btn}>Vurderingskø (3)</span>
    </>
  );
}

function AdminScreen() {
  return (
    <>
      <div className={styles.bar}>
        <span>Drift · NGF</span>
        <span className={styles.muted}>okt 2026</span>
      </div>
      <div className={styles.kpi}>
        <div>
          <b>12</b>kurs aktive
        </div>
        <div>
          <b>4</b>i driftskø
        </div>
      </div>
      <div className={styles.muted}>Kursportefølje</div>
      <div className={styles.blocks}>
        <i className={styles.t1} />
        <i className={styles.t1} />
        <i className={styles.t1} />
        <i className={styles.t2} />
        <i className={styles.t2} />
        <i className={styles.t3} />
      </div>
      <div className={`${styles.row} ${styles.rowGap}`}>
        <span className={styles.grow}>Rapport Q3 (Excel)</span>
        <span className={styles.muted}>klar</span>
      </div>
      <div className={styles.row}>
        <span className={styles.grow}>Tilganger · 2 ventende</span>
        <span className={styles.muted}>→</span>
      </div>
      <span className={styles.btn}>Driftskø</span>
    </>
  );
}

const screens = {
  student: StudentScreen,
  teacher: TeacherScreen,
  admin: AdminScreen,
} as const;

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.brand}>
        <b>Trenerløftet</b>
        <span>Norges Golfforbund · Demo</span>
      </header>

      <h1 className={styles.title}>Velg hvordan du vil inn</h1>
      <p className={styles.lede}>
        Fiktivt demomiljø. Du kan bytte rolle når som helst.
      </p>

      <nav aria-label="Demo-roller" className={styles.stage}>
        <ul className={styles.pads}>
          {roles.map((role) => {
            const Screen = screens[role.id];
            return (
              <li key={role.id}>
                <Link className={styles.role} href={role.href}>
                  <div className={styles.pad}>
                    <div aria-hidden="true" className={styles.screen}>
                      <Screen />
                    </div>
                  </div>
                  <div className={styles.label}>
                    <strong>{role.title}</strong>
                    <small>{role.description}</small>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className={styles.foot}>Demonstrasjonsmiljø · ingen ekte persondata</p>
    </main>
  );
}
