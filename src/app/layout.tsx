import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({ subsets: ["latin"], variable: "--font-main" });

export const metadata: Metadata = {
  title: "KOVA | The Secure Vault for High-Trust Trade",
  description: "Secure your transactions with KOVA. The trust layer for Computer Village and beyond. Escrow protection for high-value physical goods.",
  openGraph: {
    title: "KOVA | The Secure Vault",
    description: "Funds secured in the SafeVault. Real-time escrow protection.",
    images: ["/og-image.png"], 
  },
  twitter: {
    card: "summary_large_image",
    title: "KOVA | Secure Every Deal",
    description: "The trust protocol for physical marketplaces.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-black text-white antialiased selection:bg-accent selection:text-white`}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
