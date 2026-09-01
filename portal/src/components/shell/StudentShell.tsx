"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DemoRoleSwitcher } from "./DemoRoleSwitcher";
import styles from "./StudentShell.module.css";

type IconName =
  "home" | "learning" | "practice" | "submissions" | "certificates" | "help";

type NavigationItem = Readonly<{
  label: string;
  icon: IconName;
  href?: string;
}>;

function Icon({ name }: { name: IconName }) {
  if (name === "certificates") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 4h10v8a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 17v3M8.5 20h7" />
      </svg>
    );
  }

  if (name === "learning") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5v-16ZM20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5v-16Z" />
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

  if (name === "submissions") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5V8h4M8 12h7M8 16h5" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.1M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 10.5 12 4l8 6.5V20H5a1 1 0 0 1-1-1v-8.5Z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("nb-NO"))
    .join("");
}

export function StudentShell({
  children,
  courseRunId,
  courseTitle,
  demoMode = false,
  userName,
}: Readonly<{
  children: ReactNode;
  courseRunId: string | null;
  courseTitle: string;
  demoMode?: boolean;
  userName: string;
}>) {
  const pathname = usePathname();
  const navigation: readonly NavigationItem[] = [
    { label: "Hjem", icon: "home", href: "/student" },
    {
      label: "Læringsløp",
      icon: "learning",
      href: courseRunId
        ? `/student/courses/${courseRunId}`
        : "/student/content",
    },
    { label: "Praksis", icon: "practice", href: "/student/practice" },
    {
      label: "Innleveringer",
      icon: "submissions",
      href: "/student/assignments",
    },
    {
      label: "Mine diplomer",
      icon: "certificates",
      href: "/student/certificates",
    },
    { label: "Hjelp", icon: "help" },
  ];

  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/student">
          <span aria-hidden="true" className={styles.brandMark}>
            T
          </span>
          <span>TRENERLØFTET</span>
        </Link>

        {demoMode ? <DemoRoleSwitcher currentRole="student" /> : null}

        <div className={styles.activeCourse}>
          <small>Aktivt kurs</small>
          <strong>{courseTitle}</strong>
        </div>

        <nav aria-label="Hovedmeny" className={styles.navigation}>
          <ul>
            {navigation.map((item) => {
              const isCurrent =
                item.href === "/student"
                  ? pathname === item.href
                  : item.label === "Læringsløp"
                    ? pathname.startsWith("/student/courses") ||
                      pathname.startsWith("/student/content") ||
                      pathname.startsWith("/student/quiz")
                    : Boolean(item.href && pathname.startsWith(item.href));

              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link
                      aria-current={isCurrent ? "page" : undefined}
                      className={styles.navigationItem}
                      data-active={isCurrent || undefined}
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
            <small>{courseTitle}</small>
          </span>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.context}>
            <span>Trenerutdanning</span>
            <span aria-hidden="true">/</span>
            <strong>Min læring</strong>
            <span className={styles.demoBadge}>DEMO · fiktive data</span>
          </div>
          <div className={styles.courseContext}>
            <Icon name="learning" />
            <span>{courseTitle}</span>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
