"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ThirdwebProvider } from "thirdweb/react";

const inter = Inter({ subsets: ["latin"], variable: "--font-main" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(dark);

    // Suppress common browser extension / wallet conflict errors in console
    const originalError = console.error;
    console.error = (...args) => {
      const msg = args[0]?.toString() || "";
      if (
        msg.includes("ethereum") || 
        msg.includes("extension") || 
        msg.includes("MetaMask") ||
        msg.includes("runtime.lastError")
      ) return;
      originalError.apply(console, args);
    };
  }, []);

  return (
    <html lang="en" className={`${inter.variable} ${isDarkMode ? 'dark-mode' : ''}`}>
      <body className="antialiased">
        {mounted && (
          <ThirdwebProvider>
            <div className="app-container min-h-screen flex flex-col">
              <header className="premium-container py-6 lg:py-10 thin-border-bottom flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="logo flex flex-col items-center md:items-start text-center md:text-left">
                  <Link href="/">
                    <h1 className="text-xl lg:text-2xl font-extrabold tracking-tighter uppercase leading-none cursor-pointer">
                      Safe<span className="hollow-text">Trade</span>
                    </h1>
                  </Link>
                  <span className="text-[10px] opacity-40 font-bold tracking-[0.2em] mt-1 uppercase">High-Trust Escrow</span>
                </div>
                <nav className="flex gap-6 lg:gap-10 items-center justify-center">
                  <Link href="/" className="text-[11px] lg:text-[12px] font-bold opacity-60 hover:opacity-100 transition-opacity">HOME</Link>
                  <Link href="/dashboard" className="text-[11px] lg:text-[12px] font-bold opacity-60 hover:opacity-100 transition-opacity">DASHBOARD</Link>
                  <div className="h-4 w-[1px] bg-white/10 mx-1 lg:mx-2" />
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="text-[9px] lg:text-[10px] font-bold border-[0.5px] border-white/20 px-3 py-1 rounded-full hover:bg-white hover:text-black transition-colors"
                  >
                    {isDarkMode ? 'LIGHT' : 'DARK'}
                  </button>
                </nav>
              </header>
              <main className="flex-grow">
                {children}
              </main>
              <footer className="premium-container px-4 md:px-8 py-12 thin-border-top mt-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                  <div className="max-w-md">
                    <h2 className="text-2xl font-extrabold mb-4">THE VAULT</h2>
                    <p className="text-sm opacity-50 leading-relaxed">
                      SafeTrade bridges the trust gap in high-activity markets using smart contract technology. 
                      Securing transactions between vendors and buyers globally.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold opacity-30 mb-2 uppercase">Protocol Version 1.0.0</p>
                    <p className="text-[10px] font-bold opacity-30 uppercase">© 2024 SAFETRADE LABS</p>
                  </div>
                </div>
              </footer>
            </div>
          </ThirdwebProvider>
        )}
      </body>
    </html>
  );
}
