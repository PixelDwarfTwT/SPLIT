import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patungan — Lebih jelas. Lebih adil.",
  description: "Kalkulator patungan berdasarkan menu dan porsi setiap orang.",
  applicationName: "Patungan",
  appleWebApp: { capable: true, title: "Patungan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#52745B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="id"><body><PwaRegister />{children}</body></html>;
}
