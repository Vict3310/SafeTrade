"use client";

import React, { useEffect, useState, use } from "react";
import { Shield, CheckCircle, Printer, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Skeleton from "@/components/Skeleton";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeal = async () => {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .eq('safe_link_id', id)
        .single();
      
      if (data) setDeal(data);
      setLoading(false);
    };
    fetchDeal();
  }, [id]);

  if (loading) return (
    <div className="premium-container pt-40 max-w-2xl mx-auto">
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!deal || deal.status !== 'Released') {
    return (
      <div className="premium-container pt-40 text-center">
        <h2 className="text-4xl font-black uppercase mb-4">Receipt <br /> <span className="hollow-text">Not Generated</span></h2>
        <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest">Receipts are only available for fully completed transactions.</p>
      </div>
    );
  }

  return (
    <div className="premium-container pt-32 pb-40 max-w-2xl mx-auto">
      <div className="bg-[#0A0A0A] border border-white/10 p-12 lg:p-20 relative overflow-hidden">
        {/* WATERMARK */}
        <Shield size={300} className="absolute -right-20 -bottom-20 opacity-[0.02] -rotate-12" />

        <div className="flex justify-between items-start mb-16">
           <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">KOVA<span className="text-accent">.</span></h1>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.4em] mt-2">Proof of Transaction</p>
           </div>
           <div className="text-right">
              <CheckCircle size={32} className="text-accent ml-auto mb-4" />
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Status: SECURED</p>
           </div>
        </div>

        <div className="structural-line h-[1px] bg-white/5 w-full mb-16" />

        <div className="space-y-12 mb-16">
           <div className="grid grid-cols-2 gap-8">
              <div>
                 <p className="text-[10px] font-bold opacity-20 uppercase tracking-widest mb-2">Item / Description</p>
                 <p className="text-xl font-bold uppercase">{deal.item_name}</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold opacity-20 uppercase tracking-widest mb-2">Safe-Link ID</p>
                 <p className="text-xl font-bold uppercase">{deal.safe_link_id}</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <div>
                 <p className="text-[10px] font-bold opacity-20 uppercase tracking-widest mb-2">Amount Paid</p>
                 <p className="text-3xl font-black">₦{deal.price_naira?.toLocaleString()}</p>
                 <p className="text-[10px] opacity-40 font-bold uppercase mt-1">~{deal.price_celo?.toFixed(4)} CELO</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-bold opacity-20 uppercase tracking-widest mb-2">Transaction Date</p>
                 <p className="text-xl font-bold uppercase">{new Date(deal.created_at).toLocaleDateString()}</p>
              </div>
           </div>
        </div>

        <div className="bg-white/5 border border-white/5 p-8 mb-16 space-y-4">
           <div className="flex justify-between items-center">
              <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Protocol Fee (1.5%)</p>
              <p className="text-[9px] font-bold uppercase">₦{deal.service_fee?.toLocaleString()}</p>
           </div>
           <div className="flex justify-between items-center">
              <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Net Payout</p>
              <p className="text-[9px] font-bold uppercase">₦{deal.payout_naira?.toLocaleString()}</p>
           </div>
        </div>

        <div className="space-y-4 opacity-20 mb-16">
           <p className="text-[8px] font-bold uppercase tracking-widest">Vendor: {deal.vendor_wallet}</p>
           <p className="text-[8px] font-bold uppercase tracking-widest">Buyer: {deal.buyer_wallet || 'Verified Party'}</p>
        </div>

        <div className="flex justify-center gap-8">
           <button onClick={() => window.print()} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:text-accent transition-colors">
              <Printer size={14} /> Print
           </button>
           <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:text-accent transition-colors opacity-40">
              <Download size={14} /> PDF
           </button>
        </div>
      </div>
    </div>
  );
}
