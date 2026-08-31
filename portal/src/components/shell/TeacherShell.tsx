"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./StudentShell.module.css";

function Icon({ name }: Readonly<{ name: "home" | "review" | "people" }>) {
  if (name === "review") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5V8h4M8 12h7M8 16h5" />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="8" cy="8" r="2.5" />
        <circle cx="16" cy="8" r="2.5" />
        <path d="M3.5 20v-2a4.5 4.5 0 0 1 9 0v2M11.5 20v-2a4.5 4.5 0 0 1 9 0v2" />
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
    .map((part) => part[0].toLocaleUpperCase("nb-NO"))
    .join("");
}

export function TeacherShell({
  children,
  courseTitle,
  userName,
}: Readonly<{
  children: ReactNode;
  courseTitle: string;
  userName: string;
}>) {
  const pathname = usePathname();
  const navigation = [
    { label: "Oversikt", href: "/teacher", icon: "home" as const },
    { label: "Deltakere", icon: "people" as const },
    { label: "Vurderinger", href: "/teacher", icon: "review" as const },
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

        <nav aria-label="Hovedmeny" className={styles.navigation}>
          <ul>
            {navigation.map((item) => {
              const current = Boolean(
                item.href &&
                (item.label === "Vurderinger"
                  ? pathname.startsWith("/teacher/assignments") ||
                    pathname.startsWith("/teacher/practice")
                  : pathname === item.href),
              );

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
            <span className={styles.demoBadge}>Demodata</span>
          </div>
          <div className={styles.courseContext}>
            <Icon name="review" />
            <span>{courseTitle}</span>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
