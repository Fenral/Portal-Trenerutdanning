"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./AdminShell.module.css";

type IconName =
  "chart" | "content" | "courses" | "people" | "reports" | "settings";

type NavigationItem = Readonly<{
  label: string;
  icon: IconName;
  href?: string;
}>;

const navigationItems: readonly NavigationItem[] = [
  { label: "Oversikt", icon: "chart" },
  { label: "Kurs", icon: "courses", href: "/admin/courses" },
  { label: "Deltakere", icon: "people" },
  { label: "Innhold", icon: "content", href: "/editor/content" },
  { label: "Rapporter", icon: "reports" },
  { label: "Innstillinger", icon: "settings" },
];

function NavigationIcon({ name }: { name: IconName }) {
  if (name === "courses") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 3v3M17 3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M15 5.5a3 3 0 0 1 0 5.5M17 13.5a4.5 4.5 0 0 1 3.5 4.4V20" />
      </svg>
    );
  }

  if (name === "content") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5V8h4M8 12h7M8 16h7" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 20V10M12 20V4M19 20v-7M3 20.5h18" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7l-2 .7v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7l2-.7Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 19.5V11l8-6 8 6v8.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5Z" />
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

export function AdminShell({
  children,
  userName,
  roleLabel = "Administrator",
  contextLabel = "Administrasjon",
  topbarLabel = "Kursår 2026",
}: {
  children: ReactNode;
  userName: string;
  roleLabel?: "Administrator" | "Redaktør";
  contextLabel?: string;
  topbarLabel?: string;
}) {
  const pathname = usePathname();
  const availableNavigationItems = navigationItems.map((item) =>
    roleLabel === "Redaktør" && item.label === "Kurs"
      ? { ...item, href: undefined }
      : item,
  );

  return (
    <div className={styles.frame}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin/courses">
          <span aria-hidden="true" className={styles.brandMark}>
            T
          </span>
          <span>TRENERLØFTET</span>
        </Link>

        <div className={styles.navigationBlock}>
          <p className={styles.navigationLabel}>Administrasjon</p>
          <nav aria-label="Hovedmeny">
            <ul>
              {availableNavigationItems.map((item) => {
                const isCurrent = Boolean(
                  item.href && pathname.startsWith(item.href),
                );

                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        aria-current={isCurrent ? "page" : undefined}
                        className={styles.navigationItem}
                        data-active={isCurrent || undefined}
                        href={item.href}
                      >
                        <NavigationIcon name={item.icon} />
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className={styles.navigationItem}
                        data-disabled="true"
                      >
                        <NavigationIcon name={item.icon} />
                        <span>{item.label}</span>
                        <small>Senere</small>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className={styles.profile}>
          <span aria-hidden="true" className={styles.avatar}>
            {initialsFor(userName)}
          </span>
          <span>
            <strong>{userName}</strong>
            <small>{roleLabel}</small>
          </span>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.context}>
            <span>Trenerutdanning</span>
            <span aria-hidden="true">/</span>
            <strong>{contextLabel}</strong>
            <span className={styles.demoBadge}>Demodata</span>
          </div>
          <div className={styles.topbarMeta}>
            <span>
              <NavigationIcon name="courses" />
              {topbarLabel}
            </span>
            <span className={styles.userIcon} title={userName}>
              {initialsFor(userName)}
            </span>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
