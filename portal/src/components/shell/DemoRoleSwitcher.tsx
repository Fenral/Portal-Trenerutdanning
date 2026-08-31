import styles from "./DemoRoleSwitcher.module.css";

export type DemoRole = "student" | "teacher" | "admin";

const demoRoles = [
  {
    id: "student",
    label: "Student",
    href: "/test-login?as=student-selma",
  },
  {
    id: "teacher",
    label: "Kurslærer",
    href: "/test-login?as=teacher-t3",
  },
  { id: "admin", label: "Admin", href: "/test-login?as=admin" },
] as const;

export function DemoRoleSwitcher({
  currentRole,
}: Readonly<{ currentRole: DemoRole }>) {
  return (
    <nav aria-label="Bytt demovisning" className={styles.switcher}>
      <p>Vis demo som</p>
      <div>
        {demoRoles.map((role) => (
          <a
            aria-current={role.id === currentRole ? "page" : undefined}
            data-current={role.id === currentRole || undefined}
            href={role.href}
            key={role.id}
          >
            {role.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
