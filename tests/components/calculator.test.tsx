// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Calculator } from "@/components/calculator";
import { completeBillSession, saveBillDraft } from "@/actions/bill-session";

vi.mock("@/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/actions/bill-session", () => ({
  saveBillDraft: vi.fn().mockResolvedValue({ ok: true }),
  completeBillSession: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));

const initialDraft = {
  id: "42a1df34-8e72-4c54-9349-6d85fef87112",
  status: "draft" as const,
  participants: [],
  menus: [],
  payments: {},
};

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Patungan calculator flow", () => {
  it("creates a menu order, calculates separate payments, and completes the bill", async () => {
    render(<Calculator initialDraft={initialDraft} />);

    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Ayu" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Bima" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah" }));
    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));

    fireEvent.change(screen.getByLabelText("Nama menu"), { target: { value: "Nasi goreng" } });
    fireEvent.change(screen.getByLabelText("Harga satuan"), { target: { value: "35000" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Ayu" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bima" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Jumlah porsi Bima" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah pesanan" }));
    expect(await screen.findByText("Nasi goreng")).toBeTruthy();
    expect(screen.getAllByText("Rp140.000")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Uang dibayar Ayu" }), { target: { value: "50000" } });
    expect(await screen.findByText("Kembalian Ayu")).toBeTruthy();
    expect(screen.getByText("Kurang bayar Bima")).toBeTruthy();
    expect(screen.getAllByText("Rp15.000")).toHaveLength(2);
    expect(screen.getAllByText("Rp105.000").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Selesai menghitung" }));
    expect(await screen.findByText("Perhitungan selesai")).toBeTruthy();
    expect(screen.getAllByText("Rp140.000").length).toBeGreaterThan(0);
    await waitFor(() => expect(saveBillDraft).toHaveBeenCalled());
    expect(completeBillSession).toHaveBeenCalledWith(initialDraft.id);
  });
});
