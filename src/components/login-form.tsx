"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { signIn } from "@/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/bill";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  function submit(values: LoginInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    startTransition(async () => {
      const result = await signIn({}, formData);
      setError(result.error ?? "");
    });
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="login-form">
      <label className="field-label" htmlFor="email">Email administrator</label>
      <div className="input-with-icon">
        <Mail size={18} aria-hidden="true" />
        <input id="email" type="email" autoComplete="username" placeholder="nama@email.com" {...register("email")} />
      </div>
      {errors.email && <p className="form-error">{errors.email.message}</p>}
      <label className="field-label" htmlFor="password">Kata sandi</label>
      <div className="input-with-icon">
        <LockKeyhole size={18} aria-hidden="true" />
        <input id="password" type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" {...register("password")} />
      </div>
      {errors.password && <p className="form-error">{errors.password.message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary login-submit" type="submit" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}<ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="login-note">Akses hanya untuk administrator Patungan.</p>
    </form>
  );
}
