import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabase.rpc("is_patungan_admin");
        if (isAdmin) redirect("/");
      }
    } catch {
      // Keep the login screen available to show setup or sign-in errors.
    }
  }
  return <main className="login-page"><section className="login-card">
    <Link className="brand-lockup login-brand" href="/" aria-label="Patungan"><span className="brand-symbol"><span /><span /><span /></span><span className="brand-name">patungan<small>Lebih jelas. Lebih adil.</small></span></Link>
    <div className="login-heading"><p className="eyebrow">Area administrator</p><h1>Masuk ke Patungan</h1><p>Semua pesanan dan perhitunganmu, tersimpan dengan aman.</p></div>
    {!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? <div className="inline-alert" role="status">Supabase belum dikonfigurasi. Isi variabel lingkungan sebelum masuk.</div> : null}
    <LoginForm />
  </section><p className="login-footer">Patungan · Lebih jelas. Lebih adil.</p></main>;
}
