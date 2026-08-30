import { can, type Permission, type Role } from "./permissions";

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "AuthorizationError";
  }
}

export function authorize(
  roles: readonly Role[],
  permission: Permission,
): void {
  if (!roles.some((role) => can(role, permission))) {
    throw new AuthorizationError(permission);
  }
}
