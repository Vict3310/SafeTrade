"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="premium-container pt-32 pb-40 max-w-4xl mx-auto">
      <Link href="/" className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase hover:opacity-100 transition-opacity mb-12">
        <ArrowLeft size={12} /> Return Home
      </Link>

      <h1 className="text-6xl font-extrabold uppercase mb-16 tracking-tighter">Terms of <br /><span className="hollow-text">Service</span></h1>

      <div className="space-y-12 text-[13px] leading-relaxed opacity-60">
        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">1. The Protocol</h2>
          <p>KOVA is a decentralized escrow protocol. By using this platform, you acknowledge that we do not hold funds directly; all assets are secured within the SafeVault smart contract on the Celo blockchain. We provide the interface and arbitration services to facilitate high-trust trade.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">2. Service Fees</h2>
          <p>A service fee of 1.5% is applied to every successful transaction. This fee supports the protocol maintenance and arbitration infrastructure. Fees are non-refundable once a transaction has been successfully released or resolved via arbitration.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">3. Arbitration</h2>
          <p>In the event of a dispute, KOVA auditors will review provided evidence. By entering into a deal, both buyer and vendor agree to abide by the final verdict rendered by our arbitration system. Our decision is final and binding within the context of the protocol.</p>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.3em] mb-4">4. Liability</h2>
          <p>KOVA is provided "as is". We are not responsible for blockchain network congestion, smart contract vulnerabilities beyond our control, or external marketplace interactions. Users are responsible for verifying their counterparty's identity and reputation.</p>
        </section>
      </div>

      <div className="mt-20 pt-20 border-t border-white/5 flex items-center justify-between">
        <p className="text-[9px] font-bold opacity-20 uppercase tracking-widest">Last Updated: May 2026</p>
        <Shield size={20} className="opacity-10" />
      </div>
    </div>
  );
}
