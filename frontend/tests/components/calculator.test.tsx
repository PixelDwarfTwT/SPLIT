// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalculatorSession } from "@/components/calculator";
import { completeBillSession, saveBillDraft } from "@/actions/bill-session";

vi.mock("@/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/actions/bill-session", () => ({
  saveBillDraft: vi.fn().mockResolvedValue({ ok: true }),
  completeBillSession: vi.fn().mockResolvedValue({ ok: true }),
}));
const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
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
  mockRouter.push.mockClear();
  mockRouter.refresh.mockClear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSingleParticipantPayment() {
  const draftWithOrder = {
    ...initialDraft,
    participants: [{ id: "ayu", name: "Ayu" }],
    menus: [{
      id: "nasi",
      name: "Nasi goreng",
      unitPrice: 35_000,
      orders: [{ participantId: "ayu", quantity: 1 }],
    }],
  };
  render(<CalculatorSession initialDraft={draftWithOrder} />);
  fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));
  fireEvent.click(screen.getByRole("button", { name: "Lanjutkan" }));
  return screen.getByRole("textbox", { name: "Uang dibayar Ayu" }) as HTMLInputElement;
}

describe("Patungan calculator flow", () => {
  it("creates a menu order, calculates separate payments, and completes the bill", async () => {
    const view = render(<CalculatorSession initialDraft={initialDraft} />);

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

    fireEvent.click(screen.getByRole("button", { name: "Perhitungan baru" }));
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();

    view.rerender(<CalculatorSession initialDraft={{ ...initialDraft, id: "f40fbc4a-4f38-4f30-bc96-ecb76ed19a17" }} />);
    expect(screen.getByRole("heading", { name: "Mulai dari peserta" })).toBeTruthy();
  });

  it("accepts and lets you replace payment amounts longer than four digits", () => {
    const payment = renderSingleParticipantPayment();
    fireEvent.focus(payment);
    for (const digit of "50000") {
      fireEvent.change(payment, { target: { value: `${payment.value}${digit}` } });
    }
    expect(payment.value).toBe("50000");
    expect(screen.getByText("Kembalian Ayu")).toBeTruthy();

    fireEvent.change(payment, { target: { value: "" } });
    fireEvent.blur(payment);
    fireEvent.focus(payment);
    for (const digit of "35000") {
      fireEvent.change(payment, { target: { value: `${payment.value}${digit}` } });
    }
    expect(payment.value).toBe("35000");
    expect(screen.getByText("Pembayaran pas")).toBeTruthy();
  });

  it("accepts a digit after a displayed thousands separator", () => {
    const payment = renderSingleParticipantPayment();
    fireEvent.focus(payment);
    fireEvent.change(payment, { target: { value: "5.000" } });
    fireEvent.change(payment, { target: { value: "5.0000" } });

    expect(payment.value).toBe("50000");
    expect(screen.getByText("Kembalian Ayu")).toBeTruthy();
  });

  it("allows payments up to Rp10.000.000 and rejects larger values", () => {
    const payment = renderSingleParticipantPayment();
    fireEvent.focus(payment);
    for (const digit of "10000000") {
      fireEvent.change(payment, { target: { value: `${payment.value}${digit}` } });
    }

    expect(payment.value).toBe("10000000");
    fireEvent.change(payment, { target: { value: "10000001" } });
    expect(payment.value).toBe("10000000");
  });
});
