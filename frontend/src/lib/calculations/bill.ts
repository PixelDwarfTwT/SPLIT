export type Participant = { id: string; name: string };
export type MenuOrder = { participantId: string; quantity: number };
export type MenuItem = {
  id: string;
  name: string;
  unitPrice: number;
  orders: MenuOrder[];
};
export type ParticipantBill = Participant & {
  bill: number;
  paid: number;
  change: number;
  shortfall: number;
  items: { menuId: string; menuName: string; quantity: number; amount: number }[];
};
export type BillSummary = {
  menus: (MenuItem & { totalQuantity: number; subtotal: number })[];
  participants: ParticipantBill[];
  menuCount: number;
  totalPortions: number;
  groupTotal: number;
  peopleWithOrders: number;
  totalPaid: number;
  totalChange: number;
  totalShortfall: number;
};

const MAX_IDR = Number.MAX_SAFE_INTEGER;

function assertWholeRupiah(value: number, label: string, allowZero = false): void {
  if (
    !Number.isSafeInteger(value) ||
    value > MAX_IDR ||
    (allowZero ? value < 0 : value <= 0)
  ) {
    throw new Error(`${label} harus berupa bilangan Rupiah bulat ${allowZero ? "nonnegatif" : "positif"}.`);
  }
}

export function calculateBill(
  participants: Participant[],
  menus: MenuItem[],
  payments: Record<string, number>,
): BillSummary {
  if (participants.length > 20) throw new Error("Maksimal 20 peserta.");

  const participantIds = new Set(participants.map(({ id }) => id));
  const seenParticipants = new Set<string>();
  for (const participant of participants) {
    const normalized = participant.name.trim().toLocaleLowerCase("id-ID");
    if (!normalized || seenParticipants.has(normalized)) {
      throw new Error("Nama peserta tidak boleh kosong atau sama.");
    }
    seenParticipants.add(normalized);
  }

  const bills = new Map<string, number>(participants.map(({ id }) => [id, 0]));
  const participantItems = new Map<string, ParticipantBill["items"]>(
    participants.map(({ id }) => [id, []]),
  );
  const menuTotals = menus.map((menu) => {
    assertWholeRupiah(menu.unitPrice, "Harga satuan");
    const orderIds = new Set<string>();
    let totalQuantity = 0;
    for (const order of menu.orders) {
      if (!participantIds.has(order.participantId) || orderIds.has(order.participantId)) {
        throw new Error("Pesanan harus merujuk peserta yang terdaftar dan tidak boleh duplikat.");
      }
      if (!Number.isSafeInteger(order.quantity) || order.quantity <= 0) {
        throw new Error("Jumlah porsi harus bilangan bulat positif.");
      }
      orderIds.add(order.participantId);
      totalQuantity += order.quantity;
      const amount = menu.unitPrice * order.quantity;
      if (!Number.isSafeInteger(amount)) throw new Error("Subtotal menu melewati batas nilai.");
      const currentBill = bills.get(order.participantId) ?? 0;
      const nextBill = currentBill + amount;
      if (!Number.isSafeInteger(nextBill)) throw new Error("Tagihan peserta melewati batas nilai.");
      bills.set(order.participantId, nextBill);
      participantItems.get(order.participantId)?.push({
        menuId: menu.id,
        menuName: menu.name,
        quantity: order.quantity,
        amount,
      });
    }
    if (totalQuantity === 0) throw new Error("Setiap menu harus memiliki pemesan.");
    const subtotal = menu.unitPrice * totalQuantity;
    if (!Number.isSafeInteger(subtotal)) throw new Error("Subtotal menu melewati batas nilai.");
    return { ...menu, totalQuantity, subtotal };
  });

  const groupTotal = menuTotals.reduce((sum, menu) => sum + menu.subtotal, 0);
  if (!Number.isSafeInteger(groupTotal)) throw new Error("Total tagihan melewati batas nilai.");

  const participantResults = participants.map((participant) => {
    const bill = bills.get(participant.id) ?? 0;
    const paid = payments[participant.id] ?? 0;
    assertWholeRupiah(paid, "Uang dibayar", true);
    return {
      ...participant,
      bill,
      paid: bill > 0 ? paid : 0,
      change: bill > 0 ? Math.max(paid - bill, 0) : 0,
      shortfall: bill > 0 ? Math.max(bill - paid, 0) : 0,
      items: participantItems.get(participant.id) ?? [],
    };
  });

  return {
    menus: menuTotals,
    participants: participantResults,
    menuCount: menus.length,
    totalPortions: menuTotals.reduce((sum, menu) => sum + menu.totalQuantity, 0),
    groupTotal,
    peopleWithOrders: participantResults.filter(({ bill }) => bill > 0).length,
    totalPaid: participantResults.reduce((sum, person) => sum + person.paid, 0),
    totalChange: participantResults.reduce((sum, person) => sum + person.change, 0),
    totalShortfall: participantResults.reduce((sum, person) => sum + person.shortfall, 0),
  };
}
