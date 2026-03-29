import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing db
const mockFrom = vi.fn();
vi.mock("./supabase.js", () => ({
  supabase: { from: mockFrom, auth: {} },
}));

// Helper to build chainable query mock
function chainMock(resolveValue = { data: null, error: null }) {
  const chain = {};
  const methods = ["select", "insert", "update", "delete", "eq", "order", "single"];
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
