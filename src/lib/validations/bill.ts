import { z } from "zod";

const uuid = z.string().uuid();
const rupiah = z.number().int().nonnegative().safe();
const participantSchema = z.object({ id: uuid, name: z.string().trim().min(1).max(80) });
const menuSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  unitPrice: z.number().int().positive().safe(),
  orders: z.array(z.object({ participantId: uuid, quantity: z.number().int().positive().safe() })).min(1),
});

export const billDraftSchema = z.object({
  id: uuid,
  participants: z.array(participantSchema).max(20),
  menus: z.array(menuSchema).max(200),
  payments: z.record(uuid, rupiah),
}).superRefine((draft, ctx) => {
  const normalizedNames = new Set<string>();
  for (const participant of draft.participants) {
    const name = participant.name.trim().toLocaleLowerCase("id-ID");
    if (normalizedNames.has(name)) {
      ctx.addIssue({ code: "custom", message: "Nama peserta tidak boleh sama." });
    }
    normalizedNames.add(name);
  }
  const participantIds = new Set(draft.participants.map(({ id }) => id));
  for (const menu of draft.menus) {
    const orderIds = new Set<string>();
    for (const order of menu.orders) {
      if (!participantIds.has(order.participantId) || orderIds.has(order.participantId)) {
        ctx.addIssue({ code: "custom", message: "Pemesan harus peserta aktif dan tidak boleh duplikat." });
      }
      orderIds.add(order.participantId);
    }
  }
  for (const participantId of Object.keys(draft.payments)) {
    if (!participantIds.has(participantId)) {
      ctx.addIssue({ code: "custom", message: "Pembayaran harus merujuk peserta aktif." });
    }
  }
});

export const loginSchema = z.object({
  email: z.email("Masukkan alamat email yang valid."),
  password: z.string().min(1, "Masukkan kata sandi."),
});

export const menuFormSchema = z.object({
  name: z.string().trim().min(1, "Masukkan nama menu.").max(120),
  unitPrice: z.string().regex(/^\d+$/, "Harga satuan harus berupa Rupiah bulat tanpa pemisah desimal.").refine((value) => Number(value) > 0, "Harga satuan harus lebih dari nol."),
});

export type BillDraftInput = z.infer<typeof billDraftSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
