import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM-SALUT Mega Cendekia",
  description: "Sistem Informasi Manajemen Sentra Layanan Universitas Terbuka Mega Cendekia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

