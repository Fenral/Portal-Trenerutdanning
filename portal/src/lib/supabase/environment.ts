function requireEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicEnvironment() {
  return {
    url: requireEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
  } as const;
}

export function getSupabaseSecretKey(): string {
  return requireEnvironmentValue("SUPABASE_SECRET_KEY");
}

export function getApplicationUrl(): string {
  return requireEnvironmentValue("NEXT_PUBLIC_APP_URL");
}

export function isE2ETestMode(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST_MODE === "true"
  );
}

export function getE2EDemoPassword(): string {
  return requireEnvironmentValue("E2E_DEMO_PASSWORD");
}
