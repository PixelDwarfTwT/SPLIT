"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { billDraftSchema, type BillDraftInput } from "@/lib/validations/bill";

export type ActionResult = { ok: boolean; error?: string };

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sesi admin berakhir. Silakan masuk kembali.");
  const { data: isAdmin, error: accessError } = await supabase.rpc("is_patungan_admin");
  if (accessError || !isAdmin) throw new Error("Akses administrator Patungan diperlukan.");
  return supabase;
}

export async function loadBillDraft(): Promise<BillDraftInput & { status: "draft" | "completed" }> {
  const supabase = await getAdminClient();
  const { data: sessionId, error: sessionError } = await supabase.rpc("create_or_get_bill_session");
  if (sessionError || !sessionId) throw new Error(sessionError?.message ?? "Perhitungan tidak dapat dimuat.");

  const [sessionResult, participantsResult, menusResult, paymentsResult] = await Promise.all([
    supabase.from("bill_sessions").select("id,status").eq("id", sessionId).single(),
    supabase.from("participants").select("id,name,sort_order").eq("session_id", sessionId).order("sort_order"),
    supabase.from("menu_items").select("id,name,unit_price,sort_order,menu_item_orders(participant_id,quantity)").eq("session_id", sessionId).order("sort_order"),
    supabase.from("participant_payments").select("participant_id,amount").eq("session_id", sessionId),
  ]);
  const { data: session } = sessionResult;
  const participants = participantsResult.data;
  const menus = menusResult.data;
  const payments = paymentsResult.data;
  const queryError = sessionResult.error ?? participantsResult.error ?? menusResult.error ?? paymentsResult.error;
  if (queryError || !session || !participants || !menus || !payments) {
    throw new Error(queryError?.message ?? "Perhitungan tidak dapat dimuat.");
  }

  return {
    id: sessionId,
    status: session.status as "draft" | "completed",
    participants: (participants ?? []).map((p) => ({ id: p.id, name: p.name })),
    menus: (menus ?? []).map((menu) => ({
      id: menu.id,
      name: menu.name,
      unitPrice: Number(menu.unit_price),
      orders: (menu.menu_item_orders ?? []).map((order) => ({
        participantId: order.participant_id,
        quantity: order.quantity,
      })),
    })),
    payments: Object.fromEntries((payments ?? []).map((payment) => [payment.participant_id, Number(payment.amount)])),
  };
}

export async function saveBillDraft(draft: unknown): Promise<ActionResult> {
  const parsed = billDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data perhitungan tidak valid." };
  try {
    const supabase = await getAdminClient();
    const { error } = await supabase.rpc("save_bill_draft", {
      p_session_id: parsed.data.id,
      p_participants: parsed.data.participants,
      p_menus: parsed.data.menus,
      p_payments: parsed.data.payments,
    });
    if (error) throw error;
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Perhitungan gagal disimpan." };
  }
}

export async function completeBillSession(sessionId: string): Promise<ActionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return { ok: false, error: "Perhitungan tidak valid." };
  try {
    const supabase = await getAdminClient();
    const { error } = await supabase.rpc("complete_bill_session", { p_session_id: sessionId });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Perhitungan tidak dapat diselesaikan." };
  }
}
