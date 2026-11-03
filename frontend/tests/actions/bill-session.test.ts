// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockRevalidatePath } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { completeBillSession } from "@/actions/bill-session";

describe("completeBillSession", () => {
  beforeEach(() => {
    mockRevalidatePath.mockClear();
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin" } }, error: null }),
      },
      rpc: vi.fn(async (functionName: string) => {
        if (functionName === "is_patungan_admin") return { data: true, error: null };
        return { data: null, error: null };
      }),
    });
  });

  it("leaves the completed screen in place until the user starts a new calculation", async () => {
    const result = await completeBillSession("42a1df34-8e72-4c54-9349-6d85fef87112");

    expect(result).toEqual({ ok: true });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
