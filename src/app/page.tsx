import { redirect } from "next/navigation";
import Link from "next/link";
import { Calculator } from "@/components/calculator";
import { loadBillDraft } from "@/actions/bill-session";
import { signOut } from "@/actions/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let draft: Awaited<ReturnType<typeof loadBillDraft>> | null = null;
  let loadMessage = "";
  try {
    draft = await loadBillDraft();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sesi admin tidak ditemukan.";
    if (message.includes("Sesi admin") || message.includes("Auth session missing") || message.includes("Supabase belum dikonfigurasi")) redirect("/login");
    loadMessage = message;
  }
  if (!draft) return <main className="app-shell"><section className="panel setup-error"><p className="eyebrow">Patungan</p><h1>Belum dapat membuka perhitungan.</h1><p>{loadMessage}</p><Link className="button button-secondary" href="/login">Kembali ke halaman masuk</Link><form action={signOut}><button className="button button-secondary" type="submit">Keluar</button></form></section></main>;
  return <Calculator initialDraft={draft} />;
}
