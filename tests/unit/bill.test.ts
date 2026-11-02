import { describe, expect, it } from "vitest";
import { calculateBill } from "@/lib/calculations/bill";
import { parseRupiahInput } from "@/lib/currency";
import { billDraftSchema } from "@/lib/validations/bill";

const participants = [
  { id: "ayu", name: "Ayu" },
  { id: "bima", name: "Bima" },
  { id: "citra", name: "Citra" },
];

const menus = [
  {
    id: "nasi",
    name: "Nasi goreng",
    unitPrice: 35_000,
    orders: [
      { participantId: "ayu", quantity: 1 },
      { participantId: "bima", quantity: 3 },
    ],
  },
  {
    id: "teh",
    name: "Es teh",
    unitPrice: 8_000,
    orders: [
      { participantId: "ayu", quantity: 1 },
      { participantId: "bima", quantity: 2 },
      { participantId: "citra", quantity: 1 },
    ],
  },
];

describe("calculateBill", () => {
  it("reconciles menu subtotals, portions, group total, and each participant bill", () => {
    const result = calculateBill(participants, menus, {});

    expect(result.menus.reduce((total, menu) => total + menu.subtotal, 0)).toBe(172_000);
    expect(result.totalPortions).toBe(8);
    expect(result.groupTotal).toBe(172_000);
    expect(result.participants.map(({ bill }) => bill)).toEqual([43_000, 121_000, 8_000]);
    expect(result.participants.reduce((total, person) => total + person.bill, 0)).toBe(
      result.groupTotal,
    );
  });

  it.each([
    [43_000, 0, 0],
    [50_000, 7_000, 0],
    [12_000, 0, 31_000],
    [0, 0, 43_000],
  ])("calculates independent payment %i => change %i and shortfall %i", (paid, change, shortfall) => {
    const result = calculateBill(participants, menus, { ayu: paid });
    expect(result.participants[0]).toMatchObject({ paid, change, shortfall });
  });

  it("ignores participants without orders in payer totals", () => {
    const result = calculateBill(
      [...participants, { id: "dina", name: "Dina" }],
      menus,
      { dina: 50_000 },
    );
    expect(result.peopleWithOrders).toBe(3);
    expect(result.participants.find(({ id }) => id === "dina")?.bill).toBe(0);
    expect(result.totalPaid).toBe(0);
  });

  it("supports the 20 person limit and rejects invalid monetary or order values", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({
      id: `p${index}`,
      name: `Orang ${index}`,
    }));
    const result = calculateBill(
      twenty,
      [
        {
          id: "menu",
          name: "Menu",
          unitPrice: 1,
          orders: twenty.map((person) => ({ participantId: person.id, quantity: 1 })),
        },
      ],
      {},
    );
    expect(result.groupTotal).toBe(20);
    expect(() =>
      calculateBill(participants, [{ ...menus[0], unitPrice: -1 }], {}),
    ).toThrow();
    expect(() =>
      calculateBill(participants, [{ ...menus[0], orders: [{ participantId: "ayu", quantity: 0 }] }], {}),
    ).toThrow();
  });

  it("rejects fractional and negative payment text instead of turning it into another amount", () => {
    expect(parseRupiahInput("35.5")).toBeNull();
    expect(parseRupiahInput("-35000")).toBeNull();
    expect(parseRupiahInput("Rp35.000")).toBe(35_000);
  });

  it("accepts payment drafts up to Rp10.000.000 and rejects larger amounts", () => {
    const participantId = "42a1df34-8e72-4c54-9349-6d85fef87112";
    const draft = {
      id: "98e1f3c2-9c39-4e93-8c62-3cb93b833a72",
      participants: [{ id: participantId, name: "Ayu" }],
      menus: [{
        id: "e8c8c9c0-a8f2-43e4-97e8-f11c4c7338c2",
        name: "Nasi goreng",
        unitPrice: 35_000,
        orders: [{ participantId, quantity: 1 }],
      }],
      payments: { [participantId]: 10_000_000 },
    };

    expect(billDraftSchema.safeParse(draft).success).toBe(true);
    expect(billDraftSchema.safeParse({
      ...draft,
      payments: { [participantId]: 10_000_001 },
    }).success).toBe(false);
  });
});
