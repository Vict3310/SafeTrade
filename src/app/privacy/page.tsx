"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="premium-container pt-32 pb-40 max-w-4xl mx-auto">
      <Link href="/" className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase hover:opacity-100 transition-opacity mb-12">
        <ArrowLeft size={12} /> Return Home
      </Link>

      <h1 className="text-6xl font-extrabold uppercase mb-16 tracking-tighter">Privacy <br /><span className="hollow-text">Protocol</span></h1>

      <div className="space-y-12 text-[13px] leading-relaxed opacity-60">
        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">1. Data Philosophy</h2>
          <p>Privacy is a human right. KOVA is designed to collect the minimum amount of data required to facilitate secure trade. Most transaction data exists publicly on the Celo blockchain, where it is pseudonymized by your wallet address.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">2. Collected Information</h2>
          <p>We store your wallet address, provided phone number (for WhatsApp notifications), and business name in our secure Supabase instance. We do not track your IP address, geolocation, or browser fingerprinting beyond what is necessary for security and performance.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">3. Third-Party Services</h2>
          <p>We utilize Thirdweb for blockchain interaction and Supabase for database management. These services have their own privacy protocols. We do not sell your data to third parties; our revenue is strictly derived from the 1.5% protocol service fee.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">4. Your Rights</h2>
          <p>You can request to wipe your profile data at any time via the Settings panel. Please note that blockchain transaction history is immutable and cannot be deleted from the Celo network.</p>
        </section>
      </div>

      <div className="mt-20 pt-20 border-t border-white/5 flex items-center justify-between">
        <p className="text-[9px] font-bold opacity-20 uppercase tracking-widest">Safe-Data Standard Active</p>
        <Lock size={20} className="opacity-10" />
      </div>
    </div>
  );
}
