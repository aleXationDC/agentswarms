import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return { query, from: vi.fn().mockReturnValue(query) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import {
  DashboardConflictError,
  restoreDashboardVersion,
  type BiVersionRow,
} from "@/lib/biDashboards";

const version: BiVersionRow = {
  id: "saved-version",
  dashboard_id: "owned-dashboard",
  label: "Before change",
  name: "Synthetic view",
  widgets: [],
  pages: [],
  layout: [],
  filters: [],
  theme: null,
  created_at: "2026-10-06T00:00:00Z",
};

describe("native History restore uses existing content concurrency guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores the saved definition at exactly the loaded version and increments it", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: { version: 8 }, error: null });
    await restoreDashboardVersion(version, 7);
    expect(mocks.from).toHaveBeenCalledWith("bi_dashboards");
    expect(mocks.query.eq.mock.calls).toEqual([
      ["id", version.dashboard_id],
      ["version", 7],
    ]);
    expect(mocks.query.update).toHaveBeenCalledWith({
      name: version.name,
      widgets: [],
      pages: [],
      layout: [],
      filters: [],
      theme: null,
      version: 8,
    });
  });

  it("rejects stale or repeated restore instead of an unguarded overwrite", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(restoreDashboardVersion(version, 7)).rejects.toBeInstanceOf(
      DashboardConflictError,
    );
    expect(mocks.query.update).toHaveBeenCalledTimes(1);
    expect(mocks.query.eq).toHaveBeenCalledWith("version", 7);
  });

  it("surfaces persisted authorization/write errors", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "native RLS denied restore" },
    });
    await expect(restoreDashboardVersion(version, 7)).rejects.toThrow("native RLS denied restore");
  });
});
