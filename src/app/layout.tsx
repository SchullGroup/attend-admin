import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["300","400","500","600","700","800"] });

export const metadata: Metadata = {
  title: "Attend Admin",
  description: "Attend Enterprise Event Platform — Admin Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
