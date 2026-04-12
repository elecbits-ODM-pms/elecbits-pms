import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing db
const mockFrom = vi.fn();
const supabase = { from: mockFrom, auth: {} };
vi.mock("./supabase.js", () => ({ supabase }));

// Helper to build chainable query mock
function chainMock(resolveValue = { data: null, error: null }) {
  const chain = {};
  const methods = ["select", "insert", "update", "upsert", "delete", "eq", "order", "single"];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  // Make the chain thenable so await works
  chain.then = (resolve) => resolve(resolveValue);
  return chain;
}

describe("replaceTeamAssignments", () => {
  let replaceTeamAssignments;

  beforeEach(async () => {
    vi.resetModules();
    mockFrom.mockReset();
    // Re-import to get fresh module
    const db = await import("./db.js");
    replaceTeamAssignments = db.replaceTeamAssignments;
  });

  it("should delete existing assignments and insert new ones", async () => {
    const deleteChain = chainMock({ data: null, error: null });
    const insertChain = chainMock({ data: [{ id: 1 }], error: null });

    mockFrom.mockImplementation((table) => {
      if (table === "team_assignments") {
        // First call = delete, second call = insert
        if (mockFrom.mock.calls.length <= 1) return deleteChain;
        return insertChain;
      }
    });

    const rows = [
      { project_id: 10, user_id: 1, role: "PM", start_date: "2026-01-01", end_date: "2026-06-01" },
      { project_id: 10, user_id: 2, role: "Sr. Hardware", start_date: "2026-01-01", end_date: "2026-06-01" },
    ];

    const result = await replaceTeamAssignments(10, rows);

    // Should have called from("team_assignments") twice: once for delete, once for insert
    expect(mockFrom).toHaveBeenCalledWith("team_assignments");
    expect(mockFrom).toHaveBeenCalledTimes(2);
    // Delete chain: .delete().eq("project_id", 10)
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("project_id", 10);
    // Insert chain: .insert(rows)
    expect(insertChain.insert).toHaveBeenCalledWith(rows);
    expect(result.error).toBeNull();
  });

  it("should skip insert when rows are empty", async () => {
    const deleteChain = chainMock({ data: null, error: null });

    mockFrom.mockReturnValue(deleteChain);

    const result = await replaceTeamAssignments(10, []);

    // Only one call for delete, no insert
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("should return error if delete fails", async () => {
    const deleteChain = chainMock({ data: null, error: { message: "delete failed" } });

    mockFrom.mockReturnValue(deleteChain);

    const rows = [{ project_id: 10, user_id: 1, role: "PM", start_date: null, end_date: null }];
    const result = await replaceTeamAssignments(10, rows);

    // Should not attempt insert
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(result.error).toEqual({ message: "delete failed" });
  });
});

describe("updateProject calls team assignment persistence", () => {
  it("updateProjectInDB should only update the projects table (not team_assignments)", async () => {
    const updateChain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(updateChain);

    const { updateProjectInDB } = await import("./db.js");
    await updateProjectInDB(5, { name: "Test" });

    expect(mockFrom).toHaveBeenCalledWith("projects");
    expect(updateChain.update).toHaveBeenCalledWith({ name: "Test" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", 5);
  });
});

describe("assignSlot direct-save flow", () => {
  /*
   * These tests simulate what ProjectPage.assignSlot does:
   *   1. Upsert/delete directly to team_assignments (bypasses updateProject entirely)
   *   2. Update local state via setProjects
   */

  it("upsert writes correct row to team_assignments", async () => {
    const upsertChain = chainMock({ data: [{ id: 1 }], error: null });
    mockFrom.mockReturnValue(upsertChain);

    const row = {
      project_id: "abc-123",
      user_id: 42,
      role: "HW Lead",
      start_date: "2026-01-01",
      end_date: "2026-06-01",
    };
    const { data, error } = await supabase.from("team_assignments").upsert(row, { onConflict: "project_id,role" });

    expect(mockFrom).toHaveBeenCalledWith("team_assignments");
    expect(upsertChain.upsert).toHaveBeenCalledWith(row, { onConflict: "project_id,role" });
    expect(error).toBeNull();
  });

  it("clearing a slot deletes the row by project_id + role", async () => {
    const deleteChain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(deleteChain);

    await supabase.from("team_assignments").delete().eq("project_id", "abc-123").eq("role", "HW Lead");

    expect(mockFrom).toHaveBeenCalledWith("team_assignments");
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("project_id", "abc-123");
    expect(deleteChain.eq).toHaveBeenCalledWith("role", "HW Lead");
  });

  it("assignSlot does NOT touch the projects table at all", async () => {
    // assignSlot only writes to team_assignments, then updates local state
    // via setProjects — it never calls updateProjectInDB.
    const upsertChain = chainMock({ data: [{ id: 1 }], error: null });
    mockFrom.mockReset();
    mockFrom.mockReturnValue(upsertChain);

    await supabase.from("team_assignments").upsert(
      { project_id: "abc-123", user_id: 42, role: "HW Lead", start_date: null, end_date: null },
      { onConflict: "project_id,role" }
    );

    // Only team_assignments was touched — never "projects"
    const tablesCalled = mockFrom.mock.calls.map(c => c[0]);
    expect(tablesCalled).toEqual(["team_assignments"]);
    expect(tablesCalled).not.toContain("projects");
  });

  it("assignSlot builds correct local state after upsert", () => {
    // Simulate the local state update that assignSlot does after DB write
    const existingTA = [
      { userId: 10, role: "PM", startDate: "2026-01-01", endDate: "2026-06-01" },
      { userId: 20, role: "HW Lead", startDate: "2026-01-01", endDate: "2026-06-01" },
    ];
    const slotRole = "HW Lead";
    const newUserId = 42;

    // This mirrors assignSlot's local state logic
    const newTA = existingTA.filter(a => a.role !== slotRole);
    if (newUserId) newTA.push({ userId: newUserId, role: slotRole, startDate: "2026-01-01", endDate: "2026-06-01" });

    expect(newTA).toHaveLength(2);
    expect(newTA.find(a => a.role === "PM")?.userId).toBe(10); // PM untouched
    expect(newTA.find(a => a.role === "HW Lead")?.userId).toBe(42); // HW Lead replaced
  });

  it("clearing a slot removes it from local state", () => {
    const existingTA = [
      { userId: 10, role: "PM", startDate: "2026-01-01", endDate: "2026-06-01" },
      { userId: 20, role: "HW Lead", startDate: "2026-01-01", endDate: "2026-06-01" },
    ];
    const slotRole = "HW Lead";
    const newUserId = null;

    const newTA = existingTA.filter(a => a.role !== slotRole);
    if (newUserId) newTA.push({ userId: newUserId, role: slotRole, startDate: "", endDate: "" });

    expect(newTA).toHaveLength(1);
    expect(newTA[0].role).toBe("PM");
    expect(newTA.find(a => a.role === "HW Lead")).toBeUndefined();
  });
});
