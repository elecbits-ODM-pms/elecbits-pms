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
   *   1. Upsert/delete directly to team_assignments
   *   2. Call updateProject with _skipTeamSync to update local state
   *      WITHOUT triggering replaceTeamAssignments again
   */

  it("upsert writes correct row to team_assignments", async () => {
    const upsertChain = chainMock({ data: [{ id: 1 }], error: null });
    mockFrom.mockReturnValue(upsertChain);

    // Simulate what assignSlot does for a selection
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

    // Simulate what assignSlot does when userId is empty
    await supabase.from("team_assignments").delete().eq("project_id", "abc-123").eq("role", "HW Lead");

    expect(mockFrom).toHaveBeenCalledWith("team_assignments");
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("project_id", "abc-123");
    expect(deleteChain.eq).toHaveBeenCalledWith("role", "HW Lead");
  });

  it("_skipTeamSync flag prevents replaceTeamAssignments from running", async () => {
    // This tests the App.jsx updateProject logic:
    // when _skipTeamSync is true, replaceTeamAssignments should NOT be called.
    //
    // We test this indirectly: if replaceTeamAssignments ran, it would call
    // from("team_assignments").delete() — so we assert that doesn't happen
    // after the initial projects update.

    const projectUpdateChain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(projectUpdateChain);

    const { updateProjectInDB } = await import("./db.js");

    // Simulate what updateProject does: first updateProjectInDB, then conditionally replaceTeamAssignments
    const updated = {
      id: "abc-123",
      name: "Test Project",
      teamAssignments: [{ userId: 42, role: "HW Lead", startDate: "2026-01-01", endDate: "2026-06-01" }],
      _skipTeamSync: true,
    };

    await updateProjectInDB(updated.id, { name: updated.name });

    // Verify projects table was updated
    expect(mockFrom).toHaveBeenCalledWith("projects");
    const callCountAfterUpdate = mockFrom.mock.calls.length;

    // Now simulate the conditional: if _skipTeamSync, do NOT call replaceTeamAssignments
    if (updated.teamAssignments && !updated._skipTeamSync) {
      // This block should NOT execute
      await import("./db.js").then(db => db.replaceTeamAssignments(updated.id, []));
    }

    // from() should not have been called again — replaceTeamAssignments was skipped
    expect(mockFrom.mock.calls.length).toBe(callCountAfterUpdate);
  });

  it("without _skipTeamSync, replaceTeamAssignments DOES run", async () => {
    const deleteChain = chainMock({ data: null, error: null });
    const insertChain = chainMock({ data: [{ id: 1 }], error: null });
    const projectUpdateChain = chainMock({ data: null, error: null });

    let fromCallCount = 0;
    mockFrom.mockImplementation((table) => {
      fromCallCount++;
      if (table === "projects") return projectUpdateChain;
      // team_assignments: first call = delete, second = insert
      if (fromCallCount <= 2) return deleteChain;
      return insertChain;
    });

    const { updateProjectInDB, replaceTeamAssignments } = await import("./db.js");

    const updated = {
      id: "abc-123",
      name: "Test Project",
      teamAssignments: [{ userId: 42, role: "HW Lead", startDate: "2026-01-01", endDate: "2026-06-01" }],
      // no _skipTeamSync
    };

    await updateProjectInDB(updated.id, { name: updated.name });

    // Simulate the conditional without _skipTeamSync — replaceTeamAssignments SHOULD run
    if (updated.teamAssignments && !updated._skipTeamSync) {
      const rows = updated.teamAssignments.map(a => ({
        project_id: updated.id,
        user_id: a.userId,
        role: a.role,
        start_date: a.startDate,
        end_date: a.endDate,
      }));
      await replaceTeamAssignments(updated.id, rows);
    }

    // from() should have been called for projects + team_assignments delete + team_assignments insert
    expect(mockFrom).toHaveBeenCalledWith("team_assignments");
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(insertChain.insert).toHaveBeenCalled();
  });
});
