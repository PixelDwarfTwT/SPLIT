import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBill } from "../../src/lib/calculations/bill.ts";
import { formatRupiah, parseRupiahInput } from "../../src/lib/currency.ts";

const people = [{ id: "ayu", name: "Ayu" }, { id: "bima", name: "Bima" }];

describe("Patungan IDR calculation", () => {
  it("reconciles menu quantities and an individual bill", () => {
    const result = calculateBill(people, [{
      id: "nasi", name: "Nasi goreng", unitPrice: 35_000,
      orders: [{ participantId: "ayu", quantity: 1 }, { participantId: "bima", quantity: 3 }],
    }], {});
    assert.equal(result.groupTotal, 140_000);
    assert.equal(result.totalPortions, 4);
    assert.deepEqual(result.participants.map(({ bill }) => bill), [35_000, 105_000]);
  });

  it("keeps each participant's overpayment and shortfall independent", () => {
    const result = calculateBill(people, [{
      id: "menu", name: "Menu", unitPrice: 35_000,
      orders: [{ participantId: "ayu", quantity: 1 }, { participantId: "bima", quantity: 1 }],
    }], { ayu: 50_000 });
    assert.deepEqual(result.participants.map(({ change, shortfall }) => ({ change, shortfall })), [
      { change: 15_000, shortfall: 0 },
      { change: 0, shortfall: 35_000 },
    ]);
    assert.equal(result.totalChange, 15_000);
    assert.equal(result.totalShortfall, 35_000);
  });

  it("handles a single participant with exact, zero, and invalid payments", () => {
    const solo = [{ id: "ayu", name: "Ayu" }];
    const menu = [{ id: "teh", name: "Es teh", unitPrice: 8_000, orders: [{ participantId: "ayu", quantity: 1 }] }];
    assert.equal(calculateBill(solo, menu, { ayu: 8_000 }).participants[0].change, 0);
    assert.equal(calculateBill(solo, menu, { ayu: 0 }).participants[0].shortfall, 8_000);
    assert.throws(() => calculateBill(solo, menu, { ayu: 1.5 }));
  });

  it("enforces 20 participants and rejects negative prices or zero portions", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, name: `Orang ${index}` }));
    const menu = [{ id: "satu", name: "Air", unitPrice: 1, orders: twenty.map(({ id }) => ({ participantId: id, quantity: 1 })) }];
    assert.equal(calculateBill(twenty, menu, {}).groupTotal, 20);
    assert.throws(() => calculateBill([...twenty, { id: "p20", name: "Orang 20" }], menu, {}));
    assert.throws(() => calculateBill(people, [{ id: "x", name: "X", unitPrice: -1, orders: [{ participantId: "ayu", quantity: 1 }] }], {}));
    assert.throws(() => calculateBill(people, [{ id: "x", name: "X", unitPrice: 1, orders: [{ participantId: "ayu", quantity: 0 }] }], {}));
  });

  it("formats and parses Rupiah with Indonesian thousand separators", () => {
    assert.equal(formatRupiah(35_000), "Rp35.000");
    assert.equal(parseRupiahInput("Rp35.000"), 35_000);
  });
});
