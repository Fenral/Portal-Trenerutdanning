type TestLoginIdentity = Readonly<{
  email: string;
  destination: string;
}>;

const syntheticAliases: Readonly<Record<string, TestLoginIdentity>> = {
  admin: {
    email: "admin.demo@nivaa.invalid",
    destination: "/admin/courses",
  },
  teacher: {
    email: "teacher.demo@nivaa.invalid",
    destination: "/teacher",
  },
  student: {
    email: "student.demo@nivaa.invalid",
    destination: "/student",
  },
  "student-emil": {
    email: "emil.berg@nivaa.invalid",
    destination: "/student",
  },
  "student-selma": {
    email: "selma.dahl@nivaa.invalid",
    destination: "/student",
  },
};

export type TestLoginResolution =
  | Readonly<{ status: "disabled" }>
  | Readonly<{ status: "invalid" }>
  | (Readonly<{ status: "allowed" }> & TestLoginIdentity);

export function resolveTestLogin(
  enabled: boolean,
  readAlias: () => string | null,
): TestLoginResolution {
  if (!enabled) {
    return { status: "disabled" };
  }

  const alias = readAlias();
  const identity = alias ? syntheticAliases[alias] : undefined;

  if (!identity) {
    return { status: "invalid" };
  }

  return { status: "allowed", ...identity };
}
