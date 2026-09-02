"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DemoRoleSwitcher } from "./DemoRoleSwitcher";
import styles from "./StudentShell.module.css";

type IconName =
  "learning" | "sessions" | "practice" | "people" | "submissions" | "inbox";

type NavigationItem = Readonly<{
  label: string;
  icon: IconName;
  href?: string;
  isCurrent?: (pathname: string) => boolean;
}>;

function Icon({ name }: Readonly<{ name: IconName }>) {
  if (name === "learning") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5v-16ZM20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5v-16Z" />
      </svg>
    );
  }

  if (name === "sessions") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="15" rx="1.5" width="16" x="4" y="5.5" />
        <path d="M4 10.5h16M8.5 3v2.5M15.5 3v2.5" />
      </svg>
    );
  }

  if (name === "practice") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="8" cy="8" r="2.5" />
        <circle cx="16" cy="8" r="2.5" />
        <path d="M3.5 20v-2a4.5 4.5 0 0 1 9 0v2M11.5 20v-2a4.5 4.5 0 0 1 9 0v2" />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="7.5" r="3" />
        <path d="M5.5 20.5v-1.75a6.5 6.5 0 0 1 13 0v1.75" />
      </svg>
    );
  }

  if (name === "inbox") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="13" rx="1.5" width="16" x="4" y="5.5" />
        <path d="m4.5 7 7.5 5.5L19.5 7" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4M8 12h7M8 16h5" />
    </svg>
  );
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase("nb-NO"))
    .join("");
}

export function TeacherShell({
  children,
  courseTitle,
  demoMode = false,
  userName,
}: Readonly<{
  children: ReactNode;
  courseTitle: string;
  demoMode?: boolean;
  userName: string;
}>) {
  const pathname = usePathname();
  const navigation: readonly NavigationItem[] = [
    { label: "Læringsløp", icon: "learning", href: "/teacher/course" },
    { label: "Samlinger", icon: "sessions", href: "/teacher/sessions" },
    { label: "Praksis", icon: "practice", href: "/teacher/practice" },
    { label: "Deltakere", icon: "people", href: "/teacher/participants" },
    {
      label: "Innleveringer",
      icon: "submissions",
      href: "/teacher",
      isCurrent: (path) =>
        path === "/teacher" || path.startsWith("/teacher/assignments"),
    },
    { label: "Inbox", icon: "inbox", href: "/teacher/inbox" },
  ];

  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/teacher">
          <span aria-hidden="true" className={styles.brandMark}>
            T
          </span>
          <span>TRENERLØFTET</span>
        </Link>

        {demoMode ? <DemoRoleSwitcher currentRole="teacher" /> : null}

        <div className={styles.activeCourse}>
          <small>Ditt kurs</small>
          <strong>{courseTitle}</strong>
        </div>

        <nav aria-label="Hovedmeny" className={styles.navigation}>
          <ul>
            {navigation.map((item) => {
              const current = item.href
                ? (item.isCurrent?.(pathname) ?? pathname.startsWith(item.href))
                : false;

              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      aria-current={current ? "page" : undefined}
                      className={styles.navigationItem}
                      data-active={current || undefined}
                      href={item.href}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className={styles.navigationItem}
                      data-disabled="true"
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      <small>Senere</small>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.profile}>
          <span aria-hidden="true" className={styles.avatar}>
            {initialsFor(userName)}
          </span>
          <span>
            <strong>{userName}</strong>
            <small>Kurslærer</small>
          </span>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.context}>
            <span>Trenerutdanning</span>
            <span aria-hidden="true">/</span>
            <strong>Lærer</strong>
            <span className={styles.demoBadge}>DEMO · fiktive data</span>
          </div>
          <div className={styles.courseContext}>
            <Icon name="submissions" />
            <span>{courseTitle}</span>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
