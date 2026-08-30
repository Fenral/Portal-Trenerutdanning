const DEMO_TODAY = new Date("2026-08-30T12:00:00+02:00");

const t1Locations = [
  { id: "t1-kristiansund", name: "Kristiansund og Omegn GK", first: "22.–24. mai", second: "26.–27. september" },
  { id: "t1-oslo", name: "Oslo GK", first: "29.–31. mai", second: "19.–20. september" },
  { id: "t1-onsoy", name: "Onsøy GK", first: "10.–12. april", second: "5.–6. september" },
  { id: "t1-stavanger", name: "Stavanger GK", first: "17.–19. april", second: "5.–6. september" },
  { id: "t1-fana", name: "Fana GK", first: "24.–26. april", second: "12.–13. september" },
  { id: "t1-grenland", name: "Grenland og Omegn GK", first: "10.–12. april", second: "12.–13. september" },
  { id: "t1-romerike", name: "Romerike GK", first: "24.–26. april", second: "19.–20. september" },
  { id: "t1-byneset", name: "Byneset GK", first: "22.–24. mai", second: "26.–27. september" },
  { id: "t1-sandane", name: "Sandane GK", first: "10.–12. april", second: "19.–20. september" },
];

const courses = {
  "t3-2026": {
    id: "t3-2026",
    level: "Trener 3",
    name: "Trener 3 · 2026–2027",
    shortName: "Trener 3 · 2026–27",
    expected: 60,
    participants: 15,
    teachers: 3,
    nextGathering: "20. september 2026",
    schedule: [
      { label: "Samling 1", date: "15. februar 2026", state: "done", detail: "Gjennomført" },
      { label: "Samling 2", date: "13.–15. mars 2026", state: "done", detail: "Gjennomført" },
      { label: "Samling 3", date: "8.–10. mai 2026", state: "done", detail: "Gjennomført" },
      { label: "Samling 4", date: "20. september 2026", state: "next", detail: "Neste samling" },
      { label: "Samling 5", date: "7. februar 2027", state: "future", detail: "Planlagt" },
      { label: "Samling 6", date: "19.–21. mars 2027", state: "future", detail: "Planlagt" },
    ],
  },
  "t2-2026": {
    id: "t2-2026",
    level: "Trener 2",
    name: "Trener 2 · 2026",
    shortName: "Trener 2 · 2026",
    expected: 68,
    participants: 15,
    teachers: 2,
    nextGathering: "18. september 2026",
    schedule: [
      { label: "Samling 1", date: "20. mars · 13:00–18:00", state: "done", detail: "Terningen Arena" },
      { label: "Samling 2", date: "1.–3. mai", state: "done", detail: "Elverum Golfklubb" },
      { label: "Samling 3", date: "18. september", state: "next", detail: "Elverum Golfklubb" },
    ],
  },
  ...Object.fromEntries(
    t1Locations.map((location) => [
      location.id,
      {
        id: location.id,
        level: "Trener 1",
        name: `Trener 1 · ${location.name}`,
        shortName: location.name,
        expected: 48,
        participants: 12,
        teachers: 2,
        nextGathering: `${location.second} 2026`,
        schedule: [
          { label: "Samling 1", date: `${location.first} 2026`, state: "done", detail: "Gjennomført" },
          { label: "Samling 2", date: `${location.second} 2026`, state: "next", detail: location.name },
        ],
      },
    ]),
  ),
};

const participants = [
  { id: "nora", name: "Nora Vik", initials: "NV", club: "Fjordglimt GK", progress: 62, practice: 24, planning: 6, modules: 7, assignment: "Må utbedres", attendance: "100 %", status: "green", lastActive: "I går" },
  { id: "emil", name: "Emil Strand", initials: "ES", club: "Nordenga GK", progress: 53, practice: 18, planning: 4, modules: 6, assignment: "Til vurdering", attendance: "100 %", status: "yellow", lastActive: "4 dager siden" },
  { id: "lea", name: "Lea Solheim", initials: "LS", club: "Vestlia GK", progress: 76, practice: 37, planning: 7, modules: 9, assignment: "Godkjent", attendance: "94 %", status: "green", lastActive: "I dag" },
  { id: "sander", name: "Sander Moen", initials: "SM", club: "Dal Golfklubb", progress: 41, practice: 12, planning: 3, modules: 5, assignment: "Ikke levert", attendance: "83 %", status: "red", lastActive: "18 dager siden", overdue: true },
  { id: "mina", name: "Mina Aas", initials: "MA", club: "Solkollen GK", progress: 68, practice: 29, planning: 5, modules: 8, assignment: "Godkjent", attendance: "100 %", status: "green", lastActive: "2 dager siden" },
  { id: "jakob", name: "Jakob Hauge", initials: "JH", club: "Havblikk GK", progress: 59, practice: 25, planning: 5, modules: 7, assignment: "Til vurdering", attendance: "89 %", status: "green", lastActive: "I går" },
  { id: "amalie", name: "Amalie Foss", initials: "AF", club: "Skogtun GK", progress: 48, practice: 20, planning: 4, modules: 6, assignment: "Må utbedres", attendance: "100 %", status: "yellow", lastActive: "8 dager siden" },
  { id: "henrik", name: "Henrik Bø", initials: "HB", club: "Sørmarka GK", progress: 37, practice: 9, planning: 2, modules: 4, assignment: "Ikke levert", attendance: "72 %", status: "red", lastActive: "21 dager siden", overdue: true },
  { id: "selma", name: "Selma Ryen", initials: "SR", club: "Åsheim GK", progress: 71, practice: 32, planning: 7, modules: 8, assignment: "Godkjent", attendance: "94 %", status: "green", lastActive: "I dag" },
  { id: "tobias", name: "Tobias Lien", initials: "TL", club: "Fjellstrand GK", progress: 50, practice: 19, planning: 5, modules: 6, assignment: "Til vurdering", attendance: "89 %", status: "yellow", lastActive: "6 dager siden" },
  { id: "ingrid", name: "Ingrid Berg", initials: "IB", club: "Østenga GK", progress: 64, practice: 27, planning: 6, modules: 7, assignment: "Godkjent", attendance: "100 %", status: "green", lastActive: "I går" },
  { id: "jonas", name: "Jonas Dahl", initials: "JD", club: "Vik Golfklubb", progress: 57, practice: 23, planning: 4, modules: 7, assignment: "Til vurdering", attendance: "83 %", status: "green", lastActive: "3 dager siden" },
  { id: "ada", name: "Ada Gran", initials: "AG", club: "Myrenga GK", progress: 66, practice: 30, planning: 6, modules: 8, assignment: "Godkjent", attendance: "100 %", status: "green", lastActive: "I dag" },
  { id: "markus", name: "Markus Lie", initials: "ML", club: "Kysten GK", progress: 46, practice: 17, planning: 3, modules: 5, assignment: "Må utbedres", attendance: "89 %", status: "yellow", lastActive: "9 dager siden" },
  { id: "thea", name: "Thea Bakke", initials: "TB", club: "Løkkenga GK", progress: 73, practice: 34, planning: 7, modules: 8, assignment: "Godkjent", attendance: "94 %", status: "green", lastActive: "I går" },
];

const studentModules = [
  { title: "Velkommen til Trener 3", done: 3, total: 3, state: "done", kind: "Pensum" },
  { title: "Trenerrollen", done: 5, total: 5, state: "done", kind: "Pensum" },
  { title: "Utøverutvikling", done: 7, total: 7, state: "done", kind: "Pensum" },
  { title: "Samling 1–3", done: 3, total: 3, state: "done", kind: "Oppmøte" },
  { title: "Planlegging av trening", done: 4, total: 7, state: "next", kind: "Pensum" },
  { title: "Golfspesifikk praksis", done: 2, total: 5, state: "active", kind: "Praksis" },
  { title: "Innleveringsoppgave", done: 1, total: 2, state: "attention", kind: "Vurdering" },
  { title: "Samling 4", done: 0, total: 1, state: "future", kind: "Oppmøte" },
  { title: "Kunnskapsprøve", done: 0, total: 1, state: "locked", kind: "Prøve" },
  { title: "Avsluttende praksis", done: 0, total: 4, state: "locked", kind: "Praksis" },
  { title: "Godkjenning", done: 0, total: 1, state: "locked", kind: "Fullføring" },
];

const stateLabels = {
  green: { label: "I rute", detail: "Følger anbefalt progresjon" },
  yellow: { label: "Litt bak", detail: "Bør følges opp" },
  red: { label: "Forsinket", detail: "Trenger konkret handling" },
};

const initialState = {
  role: "student",
  selectedCourse: "t3-2026",
  t1Expanded: true,
  teacherFilter: "all",
  invoiceHandled: false,
  activeStudent: null,
  aiAnswer: null,
};

let appState = { ...initialState };

const main = document.querySelector("#main");
const sidebar = document.querySelector("#course-sidebar");
const drawer = document.querySelector(".detail-drawer");
const drawerBackdrop = document.querySelector(".drawer-backdrop");
const modal = document.querySelector(".modal");
const modalBackdrop = document.querySelector(".modal-backdrop");
const toastRegion = document.querySelector(".toast-region");

function icon(name, size = 18) {
  const paths = {
    today: '<path d="M4 5.5h10v9H4z"/><path d="M6.5 3.5v4M11.5 3.5v4M4 8h10"/>',
    path: '<path d="M3 13c3-7 7-8 12-8"/><path d="M12 3l3 2-2 3"/><circle cx="5" cy="11.5" r="1.5"/>',
    practice: '<path d="M5 14h8M6 14V6l3-2 3 2v8"/><path d="M8 9h2M8 11.5h2"/>',
    gathering: '<circle cx="9" cy="5" r="2"/><path d="M5 14c0-3 1.5-5 4-5s4 2 4 5M3 7.5h2M13 7.5h2"/>',
    people: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><path d="M2.5 14c0-3 1.3-5 3.5-5s3.5 2 3.5 5M8.5 14c0-3 1.3-5 3.5-5s3.5 2 3.5 5"/>',
    assessment: '<path d="M5 3.5h8v11H5z"/><path d="M7 7h4M7 10h4M7 12.5h2"/>',
    report: '<path d="M3.5 14.5h11M5 12V8M9 12V4M13 12V6"/>',
    access: '<circle cx="9" cy="6" r="2.5"/><path d="M4.5 14c.3-3.1 1.8-4.7 4.5-4.7s4.2 1.6 4.5 4.7"/>',
    ai: '<path d="M9 2.8l1.2 3.1L13.5 7l-3.3 1.2L9 11.4 7.8 8.2 4.5 7l3.3-1.1z"/><path d="M13.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
    download: '<path d="M9 3v8M6 8l3 3 3-3M4 14h10"/>',
    message: '<path d="M3.5 4.5h11v7h-6l-3.5 3v-3H3.5z"/>',
    chevron: '<path d="M6.5 4.5L11 9l-4.5 4.5"/>',
    close: '<path d="M5 5l8 8M13 5l-8 8"/>',
    check: '<path d="M4 9l3 3 7-7"/>',
    alert: '<path d="M9 3l6 11H3z"/><path d="M9 7v3M9 12.5v.1"/>',
    clock: '<circle cx="9" cy="9" r="6"/><path d="M9 5.5V9l2.5 1.5"/>',
    upload: '<path d="M9 14V6M6 9l3-3 3 3M4 3.5h10"/>',
  };
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.path}</svg>`;
}

function render() {
  document.querySelectorAll(".role-button").forEach((button) => {
    const active = button.dataset.role === appState.role;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  sidebar.className = `course-sidebar ${appState.role}-sidebar`;
  sidebar.innerHTML = renderSidebar();

  if (appState.role === "student") main.innerHTML = renderStudent();
  if (appState.role === "teacher") main.innerHTML = renderTeacher();
  if (appState.role === "admin") main.innerHTML = renderAdmin();
}

function renderSidebar() {
  if (appState.role === "student") {
    return `
      <div class="sidebar-inner student-sidebar">
        <div class="sidebar-heading">
          <div><span class="eyebrow">Mitt kurs</span><h2>Trener 3</h2></div>
        </div>
        <p class="sidebar-meta">Kull 2026–2027<br>Fiktiv studentvisning</p>
        <nav class="sidebar-nav" aria-label="Studentområder">
          ${sidebarLink("today", "I dag", true)}
          ${sidebarLink("path", "Læringsløpet")}
          ${sidebarLink("practice", "Praksislogg")}
          ${sidebarLink("gathering", "Samlinger")}
        </nav>
        <div class="sidebar-footer"><strong>Demobruker</strong><br>Nora Vik · student</div>
      </div>`;
  }

  const roleTitle = appState.role === "teacher" ? "Mine kurs" : "Kursportefølje";
  return `
    <div class="sidebar-inner">
      <div class="sidebar-heading">
        <div><span class="eyebrow">${appState.role === "teacher" ? "Kurslærer" : "Forbundsadmin"}</span><h2>${roleTitle}</h2></div>
      </div>
      <div class="course-tree">
        <button class="tree-button" type="button" data-action="toggle-t1" aria-expanded="${appState.t1Expanded}">
          <span class="chevron" aria-hidden="true">${appState.t1Expanded ? "−" : "+"}</span><span>Trener 1</span><span class="tree-count">9</span>
        </button>
        <div class="tree-children" ${appState.t1Expanded ? "" : "hidden"}>
          ${t1Locations.map((location) => courseButton(location.id, location.name)).join("")}
        </div>
        ${courseButton("t2-2026", "Trener 2 · 2026", true)}
        ${courseButton("t3-2026", "Trener 3 · 2026–27", true)}
      </div>
      <div class="sidebar-footer">
        <strong>Lokale demodata</strong><br>
        Alle navn, klubber og resultater er fiktive.
      </div>
    </div>`;
}

function sidebarLink(iconName, label, active = false) {
  return `<button class="sidebar-link ${active ? "is-active" : ""}" type="button" data-action="demo-nav"><span class="sidebar-link-icon">${icon(iconName, 15)}</span><span>${label}</span></button>`;
}

function courseButton(id, label, root = false) {
  return `<button class="${root ? "tree-button" : "tree-course"} ${appState.selectedCourse === id ? "is-active" : ""}" type="button" data-action="select-course" data-course="${id}">${root ? `<span class="chevron-spacer" aria-hidden="true"></span>` : ""}<span>${label}</span>${root ? `<span class="tree-count">1</span>` : ""}</button>`;
}

function renderStudent() {
  const student = participants[0];
  return `
    <div class="page student-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Student · Trener 3 · fiktiv demo</span>
          <h1>Fortsett der du slapp</h1>
          <p>Du ligger omtrent som anbefalt. Neste samling er 20. september, og én innlevering må utbedres før du går videre.</p>
        </div>
        <div class="header-actions">
          <button class="button" type="button" data-action="open-schedule">Se alle samlinger</button>
        </div>
      </header>

      <section class="resume-band" aria-labelledby="resume-title">
        <div class="resume-index">Neste</div>
        <div>
          <h2 id="resume-title">Planlegging av treningsøkt</h2>
          <p>Modul 5 · 4 av 7 aktiviteter fullført · anbefalt før samling 4</p>
        </div>
        <button class="button light" type="button" data-action="open-module" data-module="4">Fortsett modul ${icon("chevron", 16)}</button>
      </section>

      <section class="progress-ledger" aria-label="Status for læringsløpet">
        <div class="progress-primary">
          <span class="ledger-label">Total progresjon</span>
          <strong>62 %</strong>
          <span class="status-inline good">${icon("check", 14)} I rute</span>
        </div>
        ${ledgerItem("Pensum", "7 av 11", "Fire moduler gjenstår")}
        ${ledgerItem("Praksis", "24 / 45 t", "Planlegging: 6 / 9 t")}
        ${ledgerItem("Innlevering", "Må utbedres", "Ny frist: 12. september", "watch")}
        ${ledgerItem("Kunnskapsprøve", "Låst", "Åpnes når pensum er fullført")}
      </section>

      <div class="content-grid wide-left">
        <div class="stack">
          <section class="panel competence-panel">
            <div class="panel-header">
              <div><h2>Anbefalt og din progresjon</h2><p>Læreren har lagt planen. Din posisjon oppdateres når aktiviteter fullføres.</p></div>
              <span class="pace-pill green"><span class="pace-dot"></span>I rute</span>
            </div>
            ${renderFairway(62, 60)}
          </section>

          <section class="panel">
            <div class="panel-header">
              <div><h2>Læringsløpet</h2><p>Total vises i prosent. Hver modul viser fullførte aktiviteter.</p></div>
              <span class="panel-counter">7 av 11 moduler startet</span>
            </div>
            <div class="module-strip-wrap">
              <div class="module-strip">
                ${studentModules.map((module, index) => renderModule(module, index)).join("")}
              </div>
            </div>
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <div class="panel-header"><div><h2>Neste samling</h2><p>Golf · idrettsspesifikk</p></div></div>
            <div class="panel-body">
              <div class="next-gathering-date"><strong>20</strong><span>september<br>2026</span></div>
              <h3 class="section-title">Samling 4</h3>
              <p class="body-copy">En dags forlengelse av fellessamling 2. Program og sted publiseres her.</p>
              <button class="button small" type="button" data-action="open-schedule">Se samlingsplan</button>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><div><h2>Praksislogg</h2><p>Kan sendes inn etter 45 timer</p></div></div>
            <div class="panel-body">
              <div class="practice-total"><strong>24 / 45 t</strong><span>53 % registrert</span></div>
              <div class="split-meter" aria-label="24 av 45 praksistimer, hvorav 6 timer planlegging"><span class="practice"></span><span class="planning"></span></div>
              <div class="meter-legend"><span><i class="legend-dot"></i>18 t praksis</span><span><i class="legend-dot sand"></i>6 t planlegging</span></div>
              <button class="button small" type="button" data-action="demo-nav">Registrer praksisøkt</button>
            </div>
          </section>
        </div>
      </div>
    </div>`;
}

function ledgerItem(label, value, detail, tone = "") {
  return `<div class="ledger-item ${tone}"><span class="ledger-label">${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
}

function renderFairway(actual, expected) {
  return `
    <div class="pace-comparison" aria-label="Din progresjon er ${actual} prosent og anbefalt progresjon er ${expected} prosent">
      <div class="pace-row">
        <div><strong>Din progresjon</strong><span>${actual} %</span></div>
        <div class="pace-track"><span class="pace-fill actual" style="--value:${actual}%"></span></div>
      </div>
      <div class="pace-row">
        <div><strong>Anbefalt i dag</strong><span>${expected} %</span></div>
        <div class="pace-track expected"><span class="pace-fill" style="--value:${expected}%"></span></div>
      </div>
      <div class="milestone-scale" aria-hidden="true"><span><i class="is-done"></i><strong>Oppstart</strong><small>15. februar</small></span><span><i class="is-done"></i><strong>Samling 2</strong><small>15. mars</small></span><span><i class="is-now"></i><strong>I dag</strong><small>30. august</small></span><span><i></i><strong>Avslutning</strong><small>21. mars 2027</small></span></div>
      <div class="pace-action"><span><strong>Neste anbefalte handling:</strong> fullfør modul 5 før 12. september.</span><button class="button small" type="button" data-action="open-module" data-module="4">Se modul</button></div>
    </div>`;
}

function renderModule(module, index) {
  const stateCopy = {
    done: "Fullført",
    next: "Fortsett her",
    active: `${module.done} av ${module.total}`,
    attention: "Må utbedres",
    future: "Ikke startet",
    locked: "Låst",
  }[module.state];
  return `<button class="module-card is-${module.state}" type="button" data-action="open-module" data-module="${index}"><span class="module-index">${module.state === "done" ? icon("check", 13) : String(index + 1).padStart(2, "0")}</span><small>${module.kind}</small><strong>${module.title}</strong><span class="module-state">${stateCopy}</span></button>`;
}

function renderTeacher() {
  const course = courses[appState.selectedCourse] || courses["t3-2026"];
  const courseParticipants = participants.slice(0, course.participants);
  const filtered = appState.teacherFilter === "all" ? courseParticipants : courseParticipants.filter((person) => person.status === appState.teacherFilter);
  const counts = countStatuses(courseParticipants);
  const average = Math.round(courseParticipants.reduce((sum, person) => sum + adaptProgress(person.progress, course), 0) / courseParticipants.length);

  return `
    <div class="page teacher-page">
      <header class="page-header editorial-header">
        <div>
          <span class="eyebrow">Kurslærer · ${course.level} · fiktiv demo</span>
          <h1>Følg opp kullet</h1>
          <p>${course.name}. Start med deltakere som ligger bak planen, venter på vurdering eller har en frist som er passert.</p>
        </div>
        <div class="header-actions">
          <button class="button" type="button" data-action="export">Eksporter PDF / Excel ${icon("download", 15)}</button>
          <button class="button primary" type="button" data-action="message-group">Send påminnelse ${icon("message", 15)}</button>
        </div>
      </header>

      <section class="summary-band" aria-label="Status for kullet">
        ${summaryButton("green", counts.green, "I rute", appState.teacherFilter === "green")}
        ${summaryButton("yellow", counts.yellow, "Litt bak", appState.teacherFilter === "yellow")}
        ${summaryButton("red", counts.red, "Må følges opp", appState.teacherFilter === "red")}
        <div class="summary-metric"><strong>${average} %</strong><span>Gjennomsnitt for aktive deltakere</span></div>
      </section>

      <section class="panel schedule-panel">
        <div class="panel-header"><div><h2>Samlinger og planlagt progresjon</h2><p>Neste: ${course.nextGathering}</p></div><button class="button small" type="button" data-action="edit-plan">Juster progresjonsplan</button></div>
        ${renderScheduleLine(course.schedule)}
      </section>

      <div class="teacher-layout">
        <section class="panel participant-report">
          <div class="panel-header">
            <div><h2>Deltakerprogresjon</h2><p>${filtered.length} av ${courseParticipants.length} deltakere vises · klikk en deltaker for detaljer</p></div>
            <div class="filter-tabs" aria-label="Filtrer progresjon">
              ${filterButton("all", "Alle")}${filterButton("green", "I rute")}${filterButton("yellow", "Litt bak")}${filterButton("red", "Forsinket")}
            </div>
          </div>
          <div class="report-table-wrap">
            <table class="report-table">
              <thead><tr><th>Deltaker</th><th>Total</th><th>Moduler</th><th>Praksis</th><th>Innlevering</th><th>Oppmøte</th><th>Status</th></tr></thead>
              <tbody>${filtered.map((person) => renderParticipantRow(person, course)).join("")}</tbody>
            </table>
          </div>
        </section>

        <aside class="action-queue">
          <div class="queue-heading"><span class="eyebrow">Prioritert nå</span><h2>Tre handlinger</h2></div>
          ${queueItem(participants[3], "Frist passert", "Avtal ny individuell frist.", "red")}
          ${queueItem(participants[6], "Må utbedres", "Venter på ny innsending.", "yellow")}
          ${queueItem(participants[1], "Til vurdering", "Les innleveringen og gi svar.", "blue")}
        </aside>
      </div>
    </div>`;
}

function adaptProgress(value, course) {
  if (course.level === "Trener 1") return Math.max(18, value - 10);
  if (course.level === "Trener 2") return Math.min(92, value + 4);
  return value;
}

function countStatuses(list) {
  return list.reduce((counts, person) => {
    counts[person.status] += 1;
    return counts;
  }, { green: 0, yellow: 0, red: 0 });
}

function summaryButton(filter, count, label, active) {
  return `<button class="summary-metric ${active ? "is-selected" : ""}" type="button" data-action="filter-status" data-filter="${filter}"><strong>${count}</strong><span><i class="status-dot ${filter}"></i>${label}</span></button>`;
}

function filterButton(filter, label) {
  return `<button class="filter-tab ${appState.teacherFilter === filter ? "is-active" : ""}" type="button" data-action="filter-status" data-filter="${filter}">${label}</button>`;
}

function renderScheduleLine(schedule) {
  return `<div class="course-status-line">${schedule.map((item) => `<div class="gathering-step ${item.state}"><strong>${item.label}</strong><span>${item.date}</span><span>${item.detail}</span></div>`).join("")}</div>`;
}

function renderParticipantRow(person, course) {
  const progress = adaptProgress(person.progress, course);
  const moduleTotal = course.level === "Trener 1" ? 9 : 11;
  const modules = Math.min(moduleTotal, Math.round((progress / 100) * moduleTotal));
  return `<tr data-action="open-student" data-student="${person.id}" tabindex="0">
    <td><div class="participant-cell"><span class="participant-avatar">${person.initials}</span><span><strong>${person.name}</strong><small>${person.club}</small></span></div></td>
    <td><div class="percent-cell"><span>${progress} %</span><span class="mini-meter" aria-hidden="true"><span style="--value:${progress}%"></span></span></div></td>
    <td><div class="module-progress-cell"><strong>${modules} av ${moduleTotal}</strong><small>aktiviteter</small></div></td>
    <td>${Math.min(45, person.practice)} / 45 t</td><td>${person.assignment}</td><td>${person.attendance}</td>
    <td><span class="status-pill ${person.status}"><span class="pace-dot"></span>${stateLabels[person.status].label}</span></td>
  </tr>`;
}

function queueItem(person, status, action, tone) {
  return `<button class="queue-item ${tone}" type="button" data-action="open-student" data-student="${person.id}"><span class="participant-avatar">${person.initials}</span><span><strong>${person.name}</strong><small>${status}<br>${action}</small></span>${icon("chevron", 16)}</button>`;
}

function renderAdmin() {
  const activeParticipants = Object.values(courses).reduce((sum, course) => sum + course.participants, 0);
  return `
    <div class="page admin-page">
      <header class="page-header editorial-header">
        <div>
          <span class="eyebrow">Forbundsadmin · NGF · fiktiv demo</span>
          <h1>Drift i dag</h1>
          <p>Følg avvik, kursportefølje og objektive rapporter. Bare administrator har tilgang til AI-søk og kontosammenslåing.</p>
        </div>
        <div class="header-actions">
          <button class="button" type="button" data-action="open-import">Importer fra Checkin ${icon("upload", 15)}</button>
          <button class="button primary" type="button" data-action="export">Generer rapport ${icon("download", 15)}</button>
        </div>
      </header>

      <nav class="admin-tabs" aria-label="Administrasjonsområder">
        <button class="is-active" type="button" data-action="admin-tab">${icon("report", 16)}<span>Innsikt</span></button>
        <button type="button" data-action="admin-tab">${icon("path", 16)}<span>Læringsløp</span></button>
        <button type="button" data-action="admin-tab">${icon("assessment", 16)}<span>Innhold</span></button>
        <button type="button" data-action="admin-tab">${icon("access", 16)}<span>Tilganger</span></button>
        <button type="button" data-action="scroll-ai">${icon("ai", 16)}<span>AI-søk</span></button>
      </nav>

      <section class="admin-masthead">
        <div><strong>11</strong><span>aktive kursgjennomføringer</span></div>
        <div><strong>${activeParticipants}</strong><span>aktive deltakerplasser</span></div>
        <div><strong>3</strong><span>oppgaver krever handling</span></div>
        <div><strong>0</strong><span>kritiske systemfeil</span></div>
      </section>

      <div class="admin-overview">
        <div class="stack">
          <section class="panel">
            <div class="panel-header"><div><h2>Kursportefølje 2026</h2><p>Velg kurs i menyen for å se deltakere, progresjon og rapporter.</p></div><span class="panel-counter">Trener 1 kan kollapses</span></div>
            <div class="portfolio-list">
              ${portfolioRow("Trener 1", "9 kurssteder", "108", "48 %", "9", "t1-oslo")}
              ${portfolioRow("Trener 2", "Kull 2026", "15", "64 %", "2", "t2-2026")}
              ${portfolioRow("Trener 3", "Kull 2026–2027", "15", "59 %", "3", "t3-2026")}
            </div>
          </section>

          <section class="panel ai-panel" id="ai-panel">
            <div class="panel-header">
              <div class="ai-heading"><span class="ai-mark">${icon("ai", 17)}</span><span><h2>Objektivt AI-søk</h2><p>Skrivebeskyttet · kun strukturerte data</p></span></div>
              <span class="tag ai-tag">Kun administrator</span>
            </div>
            <div class="panel-body">
              <div class="prompt-list">
                <button class="prompt-chip" type="button" data-action="run-ai" data-query="course-average">Hva er gjennomsnittlig progresjon for Trener 3?</button>
                <button class="prompt-chip" type="button" data-action="run-ai" data-query="completed">Hvor mange har fullført?</button>
                <button class="prompt-chip" type="button" data-action="run-ai" data-query="t1-locations">Hvordan er progresjonen fordelt på kursstedene i Trener 1?</button>
              </div>
              <div class="ai-answer" aria-live="polite">${renderAiAnswer()}</div>
            </div>
          </section>
        </div>

        <aside class="stack">
          <section class="operations-panel">
            <div class="queue-heading"><span class="eyebrow">Arbeidskø</span><h2>Tre oppgaver</h2></div>
            <div class="admin-task-list">
              ${appState.invoiceHandled ? handledInvoiceTask() : invoiceTask()}
              ${adminTask("Mulig duplikat", "Nora Vik / Nora K. Vik · samme klubb og telefon", "Se og sammenlign", "open-duplicate", "watch")}
              ${adminTask("Ny Checkin-fil", "Trener 1 · Oslo GK · 14 påmeldte", "Forhåndsvis import", "open-import", "info")}
            </div>
          </section>
          <section class="panel">
            <div class="panel-header"><div><h2>Datadefinisjoner</h2><p>Slik regnes rapportene</p></div></div>
            <div class="panel-body definition-list">
              <p><strong>Studentprogresjon</strong><span>Den enkeltes prosent fra 0–100.</span></p>
              <p><strong>Kullsnitt</strong><span>Gjennomsnitt for aktive deltakere. Trukket er ekskludert.</span></p>
              <p><strong>Fullført</strong><span>Bare deltakere med 100 % og formell status «Fullført».</span></p>
            </div>
          </section>
        </aside>
      </div>
    </div>`;
}

function portfolioRow(level, subtitle, participantsCount, progress, teachers, courseId) {
  return `<button class="portfolio-row" type="button" data-action="select-course" data-course="${courseId}" data-switch-role="teacher"><span><strong>${level}</strong><small>${subtitle}</small></span><span class="portfolio-owner"><strong>${participantsCount}</strong><small>deltakerplasser</small></span><span class="portfolio-metric"><strong>${progress}</strong><span>snitt</span></span><span class="portfolio-metric hide-mobile"><strong>${teachers}</strong><span>lærere</span></span><span class="portfolio-metric hide-mobile"><strong>Aktiv</strong><span>status</span></span>${icon("chevron", 17)}</button>`;
}

function invoiceTask() {
  return `<div class="task-card attention"><div class="task-topline"><strong>Fakturer klubb</strong><span class="tag attention">Ungdomsdriven</span></div><p>Fiktiv deltaker: Emil Strand · Nordenga GK. Påmeldt i Checkin, men ikke registrert møtt. Kurset kan fortsatt godkjennes.</p><button class="button small" type="button" data-action="handle-invoice">Marker som håndtert</button></div>`;
}

function handledInvoiceTask() {
  return `<div class="task-card"><div class="task-topline"><strong>Fakturer klubb</strong><span class="tag">Håndtert</span></div><p>Emil Strand · Nordenga GK. Portalen lagrer ikke beløpet; det håndteres i Checkin/regnskap.</p></div>`;
}

function adminTask(title, copy, actionLabel, action, tone) {
  return `<div class="task-card ${tone}"><div class="task-topline"><strong>${title}</strong><span class="tag">Admin</span></div><p>${copy}</p><button class="button small" type="button" data-action="${action}">${actionLabel}</button></div>`;
}

function renderAiAnswer() {
  if (!appState.aiAnswer) return `<strong>Velg et eksempelspørsmål.</strong><br>Svaret vil vise tolkning, filtre, definisjon, datakilde og resultat.`;
  const answers = {
    "course-average": `<strong>59 % gjennomsnittlig progresjon.</strong><br>Tolket som: gjennomsnitt av individuell progresjon for 15 aktive deltakere i Trener 3 · 2026–2027. Trukket: ekskludert. Kilde: kurs- og progresjonsdata per 30. august 2026.`,
    completed: `<strong>0 deltakere har fullført Trener 3 · 2026–2027.</strong><br>Definisjon: 100 % progresjon og formell status «Fullført». Kurset pågår fortsatt. Kilde: kursstatus per 30. august 2026.`,
    "t1-locations": `<strong>Oslo 52 %, Fana 50 %, Romerike 49 %, Byneset 48 %, Kristiansund 47 %, Grenland 47 %, Stavanger 46 %, Onsøy 45 %, Sandane 44 %.</strong><br>Tolket som kullsnitt per kurssted for aktive deltakere. Trukket: ekskludert. Fiktive demodata.`,
  };
  return answers[appState.aiAnswer];
}

function openStudentDrawer(studentId) {
  const person = participants.find((candidate) => candidate.id === studentId);
  if (!person) return;
  appState.activeStudent = studentId;
  document.querySelector("#drawer-title").textContent = person.name;
  document.querySelector("#drawer-content").innerHTML = renderStudentDrawer(person);
  drawerBackdrop.hidden = false;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.querySelector(".icon-button").focus();
}

function renderStudentDrawer(person) {
  const currentCourse = courses[appState.selectedCourse] || courses["t3-2026"];
  return `
    <div class="detail-profile"><span class="participant-avatar">${person.initials}</span><div><h3>${person.name}</h3><p>${person.club} · ${currentCourse.name}<br>${person.name.toLowerCase().replaceAll(" ", ".")}@demo.ngf.invalid · sist aktiv ${person.lastActive.toLowerCase()}</p></div></div>
    <div class="detail-progress-grid"><div><strong>${adaptProgress(person.progress, currentCourse)} %</strong><span>Total progresjon</span></div><div><strong>${person.practice} / 45 t</strong><span>Praksis</span></div><div><strong>${person.attendance}</strong><span>Oppmøte</span></div></div>
    <span class="status-pill ${person.status}"><span class="pace-dot"></span>${stateLabels[person.status].label}</span>
    <section class="detail-section"><h3>Hva læreren bør gjøre nå</h3><div class="notice ${person.status === "green" ? "green" : ""}">${person.status === "red" ? "Ta kontakt og avtal ny realistisk frist på det konkrete arbeidskravet." : person.status === "yellow" ? "Følg opp innleveringen og avklar neste aktivitet før samlingen." : "Ingen frist er passert. Bekreft vurderingen når dokumentasjonen er lest."}</div></section>
    <section class="detail-section"><h3>Moduler</h3><div class="detail-module-list">${studentModules.slice(0, 7).map((module, index) => `<div class="detail-module-row"><span class="module-index">${String(index + 1).padStart(2, "0")}</span><span><strong>${module.title}</strong><br><small>${module.done} av ${module.total} aktiviteter</small></span><span>${index < person.modules ? "Fullført" : index === person.modules ? "Pågår" : "Ikke startet"}</span></div>`).join("")}</div></section>
    <section class="detail-section inline-actions"><button class="button" type="button" data-action="message-student">Send melding</button><button class="button primary" type="button" data-action="export">Eksporter deltaker</button></section>`;
}

function openModuleModal(index) {
  const module = studentModules[index] || studentModules[0];
  const stateText = module.state === "locked" ? "Denne modulen er låst" : `${module.done} av ${module.total} aktiviteter fullført`;
  openModal(module.title, `Modul ${index + 1} · ${module.kind}`, `
    <div class="module-modal-intro"><span class="module-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${stateText}</h3><p>${module.state === "locked" ? "Fullfør alt obligatorisk pensum før kunnskapsprøven åpnes. Du mangler modul 5–7." : "Her vil studenten se pensum, presentasjoner, videoer, quiz og eventuelle innleveringer."}</p></div></div>
    <div class="activity-list">
      ${["Les fagstoff", "Se undervisningspresentasjon", "Svar på kontrollspørsmål"].map((label, activityIndex) => `<div class="activity-row"><span class="action-symbol">${activityIndex < module.done ? icon("check", 15) : icon("clock", 15)}</span><span><strong>${label}</strong><small>${activityIndex < module.done ? "Fullført" : module.state === "locked" ? "Låst av avhengighet" : "Ikke fullført"}</small></span>${activityIndex < module.done ? "" : `<button class="button small" type="button" ${module.state === "locked" ? "disabled" : ""} data-action="demo-nav">Åpne</button>`}</div>`).join("")}
    </div>`);
}

function openScheduleModal() {
  const course = courses[appState.selectedCourse] || courses["t3-2026"];
  openModal("Samlingsplan", course.name, `<div class="schedule-list">${course.schedule.map((item, index) => `<div class="schedule-row"><span class="date-tile"><strong>${index + 1}</strong>samling</span><span><strong>${item.label}</strong><small>${item.date}<br>${item.detail}</small></span><span class="status-pill ${item.state === "done" ? "green" : item.state === "next" ? "yellow" : ""}">${item.state === "done" ? "Gjennomført" : item.state === "next" ? "Neste" : "Planlagt"}</span></div>`).join("")}</div>`);
}

function openImportModal() {
  openModal("Importer påmeldingsdata", "Checkin · standardisert Excel-rapport", `
    <div class="import-dropzone"><strong>Trener 1 · Oslo GK · demo.xlsx</strong><p>V1 importerer navn, klubb, e-post, telefon og valg som Ungdomsdriven. Betaling og beløp blir i Checkin.</p><button class="button primary" type="button" data-action="simulate-import">Forhåndsvis 14 rader</button></div>
    <div class="import-preview"><div class="import-preview-row"><span>Navn</span><span>Klubb</span><span>Handling</span></div><div class="import-preview-row"><span>Nora Vik</span><span>Fjordglimt GK</span><span>Oppdater</span></div><div class="import-preview-row"><span>Emil Strand</span><span>Nordenga GK</span><span>Ny</span></div><div class="import-preview-row"><span>Lea Solheim</span><span>Vestlia GK</span><span>Ny</span></div></div>
    <div id="import-result"></div>`);
}

function openDuplicateModal() {
  openModal("Mulig duplikat", "Kun administrator kan slå sammen kontoer", `<div class="notice">Systemet foreslår duplikater, men slår dem aldri sammen automatisk.</div><div class="compare-accounts"><div><strong>Nora Vik</strong><p>nora.vik@demo.ngf.invalid<br>Fjordglimt GK · +47 900 00 101</p></div><div><strong>Nora K. Vik</strong><p>nora.k.vik@demo.ngf.invalid<br>Fjordglimt GK · +47 900 00 101</p></div></div><div class="inline-actions"><button class="button" type="button" data-action="close-modal">Ikke samme person</button><button class="button primary" type="button" data-action="merge-demo">Slå sammen reversibelt</button></div>`);
}

function openModal(title, eyebrow, content) {
  document.querySelector("#modal-title").textContent = title;
  document.querySelector("#modal-eyebrow").textContent = eyebrow;
  document.querySelector("#modal-content").innerHTML = content;
  modalBackdrop.hidden = false;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  modal.querySelector(".icon-button").focus();
}

function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.hidden = true;
  appState.activeStudent = null;
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  modalBackdrop.hidden = true;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3900);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-role], [data-action]");
  if (!target) return;

  if (target.dataset.role) {
    appState.role = target.dataset.role;
    if (appState.role === "student") appState.selectedCourse = "t3-2026";
    appState.teacherFilter = "all";
    closeDrawer();
    closeModal();
    render();
    main.focus();
    return;
  }

  const action = target.dataset.action;
  if (action === "toggle-t1") appState.t1Expanded = !appState.t1Expanded;
  if (action === "select-course") {
    appState.selectedCourse = target.dataset.course;
    if (target.dataset.switchRole) appState.role = target.dataset.switchRole;
    appState.teacherFilter = "all";
  }
  if (action === "filter-status") appState.teacherFilter = target.dataset.filter;
  if (["toggle-t1", "select-course", "filter-status"].includes(action)) {
    render();
    return;
  }

  if (action === "open-student") openStudentDrawer(target.dataset.student);
  if (action === "close-drawer") closeDrawer();
  if (action === "open-module") openModuleModal(Number(target.dataset.module));
  if (action === "open-schedule") openScheduleModal();
  if (action === "open-import") openImportModal();
  if (action === "open-duplicate") openDuplicateModal();
  if (action === "close-modal") closeModal();
  if (action === "handle-invoice") {
    appState.invoiceHandled = true;
    render();
    showToast("Oppgaven er markert håndtert. Beløpet lagres fortsatt bare i Checkin/regnskap.");
  }
  if (action === "run-ai") {
    appState.aiAnswer = target.dataset.query;
    render();
    document.querySelector("#ai-panel")?.scrollIntoView({ block: "center" });
  }
  if (action === "scroll-ai") document.querySelector("#ai-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (action === "simulate-import") {
    const result = document.querySelector("#import-result");
    if (result) result.innerHTML = `<div class="import-result"><div><strong>11</strong><span>nye deltakere</span></div><div><strong>3</strong><span>oppdateres</span></div><div><strong>0</strong><span>fjernes</span></div></div><div class="notice green">Filen er klar. Manglende rader vil aldri automatisk trekke tilgang.</div>`;
  }
  if (action === "merge-demo") {
    closeModal();
    showToast("Demokontoene er slått sammen reversibelt. Ingen ekte data ble endret.");
  }
  if (action === "reset-demo") {
    appState = { ...initialState };
    closeDrawer();
    closeModal();
    render();
    showToast("Demoen er tilbakestilt til 30. august 2026.");
  }
  if (["export", "message-group", "message-student", "demo-nav", "edit-plan", "admin-tab"].includes(action)) {
    const messages = {
      export: "Demo: rapporten ville blitt generert som PDF eller Excel.",
      "message-group": "Demo: påminnelsen er forhåndsvist, men ingen melding er sendt.",
      "message-student": "Demo: meldingen åpnes i kursets samtalerom.",
      "demo-nav": "Demo: denne funksjonen er vist, men lagrer ingen ekte data.",
      "edit-plan": "Demo: læreren kan justere anbefalte milepæler og påminnelsesdatoer.",
      "admin-tab": "Demo: området er med i produktplanen. Innsikt er aktiv i onsdagsdemoen.",
    };
    showToast(messages[action]);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (modal.classList.contains("is-open")) closeModal();
    else if (drawer.classList.contains("is-open")) closeDrawer();
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("tr[data-action='open-student']")) {
    event.preventDefault();
    openStudentDrawer(event.target.dataset.student);
  }
});

render();
