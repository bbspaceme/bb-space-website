import { describe, test, expect } from "vitest";
import { getRolesFromUser } from "@/auth";

describe("Auth Context", () => {
  test("getRolesFromUser extracts roles from JWT claims", () => {
    const user = {
      app_metadata: {
        roles: ["admin"],
      },
    };

    const roles = getRolesFromUser(user);
    expect(roles).toEqual(["admin"]);
  });

  test("getRolesFromUser handles missing roles", () => {
    const user = { app_metadata: {} };

    const roles = getRolesFromUser(user);
    expect(roles).toEqual([]);
  });

  test("getRolesFromUser handles null user", () => {
    const roles = getRolesFromUser(null);
    expect(roles).toEqual([]);
  });

  test("getRolesFromUser handles multiple roles", () => {
    const user = {
      app_metadata: {
        roles: ["admin", "advisor"],
      },
    };

    const roles = getRolesFromUser(user);
    expect(roles).toEqual(["admin", "advisor"]);
  });

  test("Role comparison works correctly", () => {
    const jwtRoles = getRolesFromUser({ app_metadata: { roles: ["advisor", "admin"] } });
    const isAdmin = jwtRoles.includes("admin");
    const isAdvisor = jwtRoles.includes("advisor");
    const isMember = jwtRoles.includes("member");

    expect(isAdmin).toBe(true);
    expect(isAdvisor).toBe(true);
    expect(isMember).toBe(false);
  });
});
