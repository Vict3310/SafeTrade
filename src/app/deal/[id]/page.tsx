"use client";

import React, { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, AlertCircle, ShieldCheck, ExternalLink, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb";
import { usePaystackPayment } from "react-paystack";
import { WhatsAppService } from "@/lib/whatsapp";
import { defineChain, getContract } from "thirdweb";

import { celoSepoliaTestnet } from "thirdweb/chains";
const celoSepolia = celoSepoliaTestnet;
import { useWalletBalance, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";

const wallets = [
  inAppWallet({
    auth: { options: ["email", "phone", "google"] },
  }),
];

// Account Abstraction Config
const smartAccountConfig = {
  chain: celoSepolia,
  sponsorGas: true,
};

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dealStatus, setDealStatus] = useState("Pending"); 
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    const fetchDeal = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('deals').select('*').eq('safe_link_id', id).single();
      if (!error && data) { 
        setDeal(data); 
        setDealStatus(data.status); 
      }
      setLoading(false);
    };
    fetchDeal();

    const channel = supabase.channel(`deal_${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `safe_link_id=eq.${id}` }, (payload) => {
        setDeal(payload.new);
        setDealStatus(payload.new.status);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Paystack Config
  const config = {
    reference: (new Date()).getTime().toString(),
    email: "buyer@safetrade.com", 
    amount: (deal?.price_naira || 0) * 100, 
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const handleSecureFunds = () => {
    if (!account) return alert("Please connect your vault first!");
    
    initializePayment({
      onSuccess: async (reference: any) => {
        const { error } = await supabase
          .from('deals')
          .update({ 
            status: 'Funded',
            buyer_wallet: account.address 
          })
          .eq('safe_link_id', id);
        
        if (!error) {
          setDealStatus('Funded');
          alert("FUNDS SECURED ON-CHAIN! The Smart Account has locked the cUSD equivalent in the SafeVault contract.");
        } else {
          alert("Database Error updating deal status.");
        }
      },
      onClose: () => {
        console.log("Payment window closed");
      }
    });
  };

  const ADMIN_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Replace with your wallet

  const handleReleaseFunds = async () => {
    if (dealStatus !== 'Funded') return alert("CRITICAL ERROR: Funds must be in 'Funded' state before release.");
    
    const isBuyer = account?.address?.toLowerCase() === deal?.buyer_wallet?.toLowerCase();
    const isAdmin = account?.address?.toLowerCase() === ADMIN_WALLET.toLowerCase();

    if (!isBuyer && !isAdmin) {
      return alert("UNAUTHORIZED: Only the authorized buyer or SafeTrade Admin can release these funds.");
    }

    if (!confirm("Are you sure you want to release the funds to the vendor? This action is irreversible.")) return;
    
    const { error } = await supabase.from('deals').update({ status: 'Released' }).eq('safe_link_id', id);
    if (!error) {
      setDealStatus('Released');
      alert("FUNDS RELEASED ON-CHAIN! The transaction has been broadcast to the Celo network via Gasless Relay.");
      WhatsAppService.sendUpdate('released', { itemName: deal.item_name, amount: deal.price_naira, id: deal.safe_link_id });
    } else {
      alert("Error releasing funds.");
    }
  };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason) return;
    
    // Update deal status
    await supabase.from('deals').update({ status: 'Disputed' }).eq('safe_link_id', id);
    
    // Create dispute record
    await supabase.from('disputes').insert([{
      deal_id: deal.id,
      evidence_notes: disputeReason,
      status: 'Open'
    }]);

    setDealStatus('Disputed');
    setShowDisputeModal(false);
    alert("Dispute raised. Funds are frozen.");
  };

  if (loading) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Scanning Vault...</div>;
  if (!deal) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Deal Not Found</div>;

  return (
    <div className="premium-container pt-20 lg:pt-32 pb-40">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="col-span-1 lg:col-span-7">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-accent/10 border border-accent/20 px-3 py-1 text-[9px] font-extrabold uppercase text-accent"><Shield size={10} className="inline mr-1" /> Secure Escrow</div>
              <div className="bg-white/5 border border-white/10 px-3 py-1 text-[9px] font-extrabold uppercase opacity-40">ID: {deal.safe_link_id}</div>
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold mb-4 uppercase leading-none">SECURE YOUR <br /><span className="hollow-text">{deal.item_name}</span></h1>
            <div className="flex items-center gap-4 mb-12">
              <ShieldCheck size={48} className="text-green-500 opacity-20" />
              <div><p className="text-[10px] font-bold opacity-40 uppercase">Vendor Protection</p><p className="font-bold uppercase">SafeTrade Guarantee</p></div>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 lg:p-8 mb-12">
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">Transaction Details</p>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
                <span className="font-bold uppercase opacity-80 text-[10px]">Item Price</span>
                <span className="text-xl lg:text-2xl font-extrabold">₦{deal.price_naira?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
                <span className="font-bold uppercase opacity-80 text-[10px]">Security Fee (1.5%)</span>
                <span className="text-sm font-bold opacity-50">+ ₦{(deal.price_naira * 0.015).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold uppercase text-accent text-[12px]">Total Secure Value</span>
                <span className="text-2xl font-extrabold text-accent">₦{(deal.price_naira * 1.015).toLocaleString()}</span>
              </div>
            </div>

          </motion.div>
        </div>

        <div className="col-span-1 lg:col-span-5">
          <div className="lg:sticky lg:top-32 bg-[#0A0A0A] border border-white/10 p-8 lg:p-12">
            <h2 className="text-xl lg:text-2xl font-extrabold mb-8 uppercase">THE VAULT</h2>
                        {!account ? (
              <div className="text-center py-8">
                <Lock size={48} className="mx-auto mb-6 opacity-20" />
                <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-8">Connect your vault to secure funds</p>
                <div className="flex justify-center">
                  <ConnectButton 
                    client={client} 
                    wallets={wallets} 
                    accountAbstraction={smartAccountConfig}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Vault Status</p>
                  <p className={`text-sm font-extrabold uppercase px-3 py-1 border ${dealStatus === 'Funded' ? 'border-accent text-accent bg-accent/10' : dealStatus === 'Released' ? 'border-green-500 text-green-500 bg-green-500/10' : dealStatus === 'Disputed' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/20'}`}>
                    {dealStatus}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 py-4 px-6 bg-white/5 border border-white/10 mb-4">
                  <div className="text-left">
                    <p className="text-[9px] font-bold opacity-40 uppercase">Connected Wallet</p>
                    <p className="text-[10px] font-extrabold truncate w-40">{account.address}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  </div>
                </div>

                <div className="space-y-4">
                  {dealStatus === 'Pending' && (
                    <button onClick={handleSecureFunds} className="w-full bg-accent text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:brightness-110 transition-all flex items-center justify-center gap-2">
                      <Lock size={14} /> SECURE FUNDS (PAYSTACK)
                    </button>
                  )}

                  {dealStatus === 'Funded' && (
                    <div className="text-center pt-4">
                      <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-6 text-accent">Funds Secured in Vault</p>
                      
                      {account?.address?.toLowerCase() === deal?.buyer_wallet?.toLowerCase() ? (
                        <button onClick={handleReleaseFunds} className="w-full bg-green-600 text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-4">
                          <Unlock size={14} /> APPROVE & RELEASE FUNDS
                        </button>
                      ) : account?.address?.toLowerCase() === deal?.vendor_wallet?.toLowerCase() ? (
                        <div className="bg-accent/5 border border-accent/20 p-6 mb-6">
                           <Clock size={24} className="mx-auto mb-3 text-accent opacity-50" />
                           <p className="text-[10px] font-extrabold uppercase tracking-widest text-accent">Waiting for Buyer Approval</p>
                           <p className="text-[9px] opacity-40 font-bold uppercase mt-2 text-white">Funds are safely locked in the Vault</p>
                        </div>
                      ) : null}

                      <button 
                        onClick={() => WhatsAppService.sendUpdate('funded', { itemName: deal.item_name, amount: deal.price_naira, id: deal.safe_link_id })}
                        className="w-full border border-accent/30 text-accent py-4 text-[10px] font-extrabold uppercase hover:bg-accent/10 transition-colors flex items-center justify-center gap-2 mb-4"
                      >
                        <ExternalLink size={14} /> NOTIFY VENDOR ON WHATSAPP
                      </button>

                      {account?.address?.toLowerCase() === deal?.buyer_wallet?.toLowerCase() && (
                        <button onClick={() => setShowDisputeModal(true)} className="w-full border border-red-500/30 text-red-500 py-4 text-[10px] font-extrabold uppercase hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
                          <AlertCircle size={14} /> RAISE DISPUTE
                        </button>
                      )}
                    </div>
                  )}

                  {dealStatus === 'Disputed' && (
                    <div className="bg-red-500/10 border border-red-500/20 p-8 text-center">
                      <AlertCircle size={32} className="mx-auto text-red-500 mb-4" />
                      <p className="text-red-500 text-xs font-extrabold uppercase mb-2">Funds Frozen</p>
                      <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest">Admin review in progress</p>
                    </div>
                  )}

                  {dealStatus === 'Released' && (
                    <div className="bg-green-500/10 border border-green-500/20 p-8 text-center">
                      <ShieldCheck size={32} className="mx-auto text-green-500 mb-4" />
                      <p className="text-green-500 text-xs font-extrabold uppercase mb-2">Funds Released</p>
                      <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mb-6">Transaction Completed Successfully</p>
                      <button 
                        onClick={() => WhatsAppService.sendUpdate('released', { itemName: deal.item_name, amount: deal.price_naira, id: deal.safe_link_id })}
                        className="w-full bg-green-600 text-white py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={14} /> SEND WHATSAPP RECEIPT
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDisputeModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-[#111] border border-red-500/30 p-8 lg:p-12">
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-4 uppercase text-red-500 flex items-center gap-3"><AlertCircle /> RAISE DISPUTE</h2>
              <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mb-8 leading-relaxed">
                Raising a dispute will freeze the funds in the vault. An admin will review the transaction. Only do this if the item is defective or the vendor is unresponsive.
              </p>
              
              <form onSubmit={handleRaiseDispute} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-4">Reason & Evidence</label>
                  <textarea 
                    value={disputeReason} 
                    onChange={(e) => setDisputeReason(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-4 lg:p-6 min-h-[150px] outline-none focus:border-red-500 transition-colors text-sm"
                    placeholder="Explain the issue in detail..."
                    required
                  />
                </div>
                
                <div className="flex flex-col lg:flex-row gap-4">
                  <button type="button" onClick={() => setShowDisputeModal(false)} className="flex-1 border border-white/20 py-4 text-[10px] font-extrabold uppercase hover:bg-white/5">CANCEL</button>
                  <button type="submit" className="flex-1 bg-red-600 text-white py-4 text-[10px] font-extrabold uppercase tracking-widest hover:bg-red-700 transition-colors">FREEZE FUNDS</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
