"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle, XCircle, ExternalLink, Scale, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SAFETRADE_CONTRACT_ADDRESS, SAFETRADE_ABI } from "@/lib/contracts";

export default function AdminDashboard() {
  const [disputedDeals, setDisputedDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  const { writeContract, data: hash, isPending: isTxPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash, 
    });

  useEffect(() => {
    fetchDisputes();

    // Subscribe to changes
    const channel = supabase
      .channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchDisputes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (isConfirmed && selectedDeal) {
      updateDealStatus(selectedDeal.safe_link_id, "Resolved");
      setSelectedDeal(null);
    }
  }, [isConfirmed]);

  const fetchDisputes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'Disputed')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDisputedDeals(data);
    }
    setLoading(false);
  };

  const updateDealStatus = async (id: string, status: string) => {
    await supabase
      .from('deals')
      .update({ status })
      .eq('safe_link_id', id);
    fetchDisputes();
  };

  const handleResolve = async (winner: 'Buyer' | 'Vendor', id: string | number) => {
    // Determine the actual winner address from the deal metadata
    // In our schema, we have buyer_wallet and vendor_wallet if we populated them
    // For now, we'll try to find them or use the ones from the deal object
    const winnerAddress = winner === 'Buyer' ? selectedDeal.buyer_wallet : selectedDeal.vendor_wallet;

    if (!winnerAddress) {
      alert("No wallet address found for this party. Please ensure wallets are linked.");
      return;
    }
    
    try {
      writeContract({
        address: SAFETRADE_CONTRACT_ADDRESS,
        abi: SAFETRADE_ABI,
        functionName: 'resolveDispute',
        args: [BigInt(id), winnerAddress],
        gas: 1_000_000n,
      });
    } catch (err: any) {
      console.error("Resolution error:", err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="premium-container pt-32 pb-40">
      <div className="flex justify-between items-end mb-16">
        <div>
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-red-500 mb-4 w-fit">
            <ShieldAlert size={10} /> Internal Conflict Resolution
          </div>
          <h1 className="text-7xl font-extrabold uppercase leading-none">
            DISPUTE <br />
            <span className="hollow-text">COMMAND</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Total Disputes</p>
          <p className="text-4xl font-extrabold">{disputedDeals.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-[#0A0A0A] border border-white/10">
            <div className="grid grid-cols-12 px-8 py-4 bg-white/5 text-[10px] font-bold uppercase tracking-widest opacity-40">
              <div className="col-span-5">Deal / Item</div>
              <div className="col-span-3 text-center">Amount</div>
              <div className="col-span-4 text-right">Action</div>
            </div>

            {loading ? (
              <div className="p-20 text-center opacity-20 font-bold uppercase tracking-[0.5em]">Scanning Ledger...</div>
            ) : disputedDeals.length === 0 ? (
              <div className="p-20 text-center opacity-20 font-bold uppercase tracking-[0.5em]">No Active Disputes</div>
            ) : (
              disputedDeals.map((deal) => (
                <div 
                  key={deal.id}
                  className={`grid grid-cols-12 px-8 py-8 thin-border-bottom hover:bg-white/5 transition-colors cursor-pointer ${selectedDeal?.id === deal.id ? 'bg-white/5' : ''}`}
                  onClick={() => setSelectedDeal(deal)}
                >
                  <div className="col-span-5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-500/10 flex items-center justify-center">
                      <Scale size={16} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-extrabold uppercase">{deal.item_name}</p>
                      <p className="text-[10px] opacity-40 uppercase tracking-tighter">Safe-Link: {deal.safe_link_id}</p>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center justify-center font-bold">
                    {deal.price_celo} CELO
                  </div>
                  <div className="col-span-4 flex items-center justify-end">
                    <button className="text-[9px] font-extrabold uppercase tracking-widest border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-all">
                      Review Evidence
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <AnimatePresence mode="wait">
            {selectedDeal ? (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="sticky top-32 bg-[#0A0A0A] border border-red-500/20 p-12"
              >
                <h2 className="text-2xl font-extrabold mb-8 uppercase text-red-500">Case Review</h2>
                
                <div className="space-y-8 mb-12">
                   <div>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Item Disputed</p>
                      <p className="text-xl font-extrabold uppercase">{selectedDeal.item_name}</p>
                   </div>
                   <div className="flex justify-between items-end pb-4 thin-border-bottom">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Vault Amount</p>
                    <p className="text-xl font-extrabold uppercase">{selectedDeal.price_celo} CELO</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 mb-12">
                   <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">Evidence Notes</p>
                   <p className="text-[11px] leading-relaxed opacity-60 italic">
                     "Buyer claims the item received does not match the inspection video. Vendor provided shipping receipt."
                   </p>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-bold text-center uppercase tracking-widest mb-4 opacity-40">Final Verdict</p>
                   <button 
                    onClick={() => handleResolve('Vendor', selectedDeal.blockchain_deal_id)}
                    className="w-full bg-white text-black py-5 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-3"
                   >
                     <CheckCircle size={14} /> RULE FOR VENDOR
                   </button>
                   <button 
                    onClick={() => handleResolve('Buyer', selectedDeal.blockchain_deal_id)}
                    className="w-full border border-white/20 text-white py-5 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-red-500 hover:border-red-500 transition-all flex items-center justify-center gap-3"
                   >
                     <XCircle size={14} /> REFUND BUYER
                   </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="sticky top-32 border border-white/5 p-12 text-center"
              >
                <ShieldAlert size={40} className="mx-auto mb-6 opacity-10" />
                <p className="text-[10px] font-bold opacity-20 uppercase tracking-[0.3em]">Select a case to begin <br /> resolution process</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
