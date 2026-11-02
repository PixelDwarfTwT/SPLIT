"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/bill";

export type AuthState = { error?: string };

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Masukkan email dan kata sandi yang valid." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Email atau kata sandi tidak sesuai." };
    const { data: allowed, error: accessError } = await supabase.rpc("is_patungan_admin");
    if (accessError || !allowed) {
      await supabase.auth.signOut();
      return { error: "Akun ini belum memiliki akses administrator Patungan." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Patungan tidak dapat terhubung." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
