"use client";

import React, { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, AlertCircle, ShieldCheck, ExternalLink, QrCode, Clock, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb";
import { usePaystackPayment } from "react-paystack";
import { WhatsAppService } from "@/lib/whatsapp";
import { defineChain, getContract } from "thirdweb";
import { createWallet } from "thirdweb/wallets";
import { useToast } from "@/components/Toast";
import confetti from "canvas-confetti";
import Link from "next/link";
import { EXCHANGE_RATE, SERVICE_FEE_PERCENT } from "@/lib/constants";

import { celoSepoliaTestnet } from "thirdweb/chains";
const celoSepolia = celoSepoliaTestnet;
import { useWalletBalance, useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";

const wallets = [
  createWallet("com.opera"), // MiniPay Support
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
  const { showToast } = useToast();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const [deal, setDeal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dealStatus, setDealStatus] = useState("Pending"); 
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  const fetchDeal = async () => {
    setLoading(true);
    const { data: dealData } = await supabase.from('deals').select('*').eq('safe_link_id', id).single();
    if (dealData) { 
      setDeal(dealData); 
      setDealStatus(dealData.status); 
    }

    if (account?.address) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .ilike('wallet_address', account.address)
        .maybeSingle();
      if (profileData) setProfile(profileData);
    }

    setLoading(false);
  };

  useEffect(() => {
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
    email: "buyer@kova.com", 
    amount: (deal?.price_naira || 0) * 100, 
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const handleSecureFunds = () => {
    if (!account) return showToast("Please connect your vault first!", "error");
    
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
          showToast("FUNDS SECURED ON-CHAIN! The Smart Account has locked the cUSD equivalent in the SafeVault contract.", "success");
        } else {
          showToast("Database Error updating deal status.", "error");
        }
      },
      onClose: () => {
        showToast("Payment window closed", "info");
      }
    });
  };

  const ADMIN_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Replace with your wallet
  const handleReleaseFunds = async () => {
    if (!account?.address) return showToast("Wallet not connected.", "error");
    if (dealStatus !== 'Funded') return showToast("CRITICAL ERROR: Funds must be in 'Funded' state before release.", "error");
    
    const isBuyer = account.address.toLowerCase() === deal?.buyer_wallet?.toLowerCase();
    const isAdmin = account.address.toLowerCase() === ADMIN_WALLET.toLowerCase() || profile?.role === 'admin';

    if (!isBuyer && !isAdmin) {
      return showToast("UNAUTHORIZED: Only the authorized buyer or KOVA Admin can release these funds.", "error");
    }

    if (!confirm("Are you sure you want to release the funds to the vendor? This action is irreversible. You will be asked to sign a message to authorize this.")) return;

    setTxLoading(true);

    try {
      // CRYPTOGRAPHIC CHALLENGE: Prove you own this wallet
      const message = `AUTHORIZE RELEASE: I, ${account.address}, authorize the release of funds for Safe-Link ${id}. Timestamp: ${Date.now()}`;
      
      // This pops up a "Sign Message" request in their wallet
      // In Thirdweb, we use the account object directly for signing
      await (account as any).signMessage({ message });

      const { error } = await supabase.from('deals').update({ status: 'Released' }).eq('safe_link_id', id);
      
      if (!error) {
        setDealStatus('Released');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0047FF', '#ffffff', '#00ff00']
        });
        showToast("FUNDS RELEASED ON-CHAIN! Authorization verified.", "success");
        WhatsAppService.sendUpdate('released', { itemName: deal.item_name, amount: deal.price_naira, id: deal.safe_link_id });
      } else {
        showToast("Database Error releasing funds.", "error");
      }
    } catch (err) {
      showToast("Authorization Failed: You must sign the message to release funds.", "error");
    } finally {
      setTxLoading(false);
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
    showToast("Dispute raised. Funds are frozen.", "info");
  };

  if (loading) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Scanning Vault...</div>;
  if (!deal) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Deal Not Found</div>;

  return (
    <div className="premium-container pt-20 lg:pt-32 pb-40">
      {/* Escrow Progress Tracker */}
      <div className="max-w-4xl mx-auto mb-20 px-6">
        <div className="flex justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10"></div>
          {[
            { step: 'Pending', label: 'Initiated', icon: <Plus size={12} /> },
            { step: 'Funded', label: 'Secured', icon: <Lock size={12} /> },
            { step: 'Released', label: 'Completed', icon: <ShieldCheck size={12} /> }
          ].map((s, i) => {
            const isActive = dealStatus === s.step || (dealStatus === 'Released' && i < 3) || (dealStatus === 'Funded' && i < 2);
            return (
              <div key={i} className="flex flex-col items-center gap-4 bg-[#0A0A0A] px-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isActive ? 'border-accent bg-accent text-white' : 'border-white/10 text-white/20'}`}>
                  {s.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white' : 'opacity-20'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
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
              <div><p className="text-[10px] font-bold opacity-40 uppercase">Vendor Protection</p><p className="font-bold uppercase">KOVA Guarantee</p></div>
            </div>
            
            <div className="bg-white/5 border border-white/10 p-6 lg:p-8 mb-12">
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">Transaction Details</p>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
                <span className="font-bold uppercase opacity-80 text-[10px]">Item Price</span>
                <span className="text-xl lg:text-2xl font-extrabold">₦{deal.price_naira?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/10">
                <span className="font-bold uppercase opacity-80 text-[10px]">Security Fee ({(SERVICE_FEE_PERCENT * 100).toFixed(1)}%)</span>
                <span className="text-sm font-bold opacity-50">+ ₦{(deal.price_naira * SERVICE_FEE_PERCENT).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold uppercase text-accent text-[12px]">Total Secure Value</span>
                <span className="text-2xl font-extrabold text-accent">₦{(deal.price_naira * (1 + SERVICE_FEE_PERCENT)).toLocaleString()}</span>
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
                    <Link href="/">
                      <h1 className="text-2xl font-black tracking-tighter uppercase leading-none cursor-pointer">
                        KOVA<span className="hollow-text">.</span>
                      </h1>
                    </Link>
                    <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.2em] mt-1">THE VAULT PROTOCOL</p>
                    <p className="text-[10px] font-extrabold truncate w-32">{account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
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
                      
                      {(account?.address?.toLowerCase() === deal?.buyer_wallet?.toLowerCase() || profile?.role === 'admin') && (
                        <button 
                          onClick={handleReleaseFunds} 
                          disabled={txLoading}
                          className="w-full bg-green-600 text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                        >
                          {txLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Unlock size={14} />
                          )}
                          {txLoading ? "PROCESSING AUTH..." : profile?.role === 'admin' ? "ADMIN: OVERRIDE & RELEASE" : "APPROVE & RELEASE FUNDS"}
                        </button>
                      )}

                      {profile?.role === 'admin' && (
                        <button 
                          onClick={async () => {
                            if (confirm("ADMIN OVERRIDE: Are you sure you want to refund this buyer?")) {
                              const { error } = await supabase.from('deals').update({ status: 'Refunded' }).eq('safe_link_id', id);
                              if (!error) {
                                setDealStatus('Refunded');
                                showToast("ADMIN REFUND COMPLETE", "success");
                              }
                            }
                          }}
                          className="w-full border border-red-500 text-red-500 py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2 mb-4"
                        >
                          <AlertCircle size={14} /> ADMIN: OVERRIDE & REFUND
                        </button>
                      )}

                      {account?.address?.toLowerCase() === deal?.vendor_wallet?.toLowerCase() && profile?.role !== 'admin' && (
                        <div className="bg-accent/5 border border-accent/20 p-6 mb-6">
                           <Clock size={24} className="mx-auto mb-3 text-accent opacity-50" />
                           <p className="text-[10px] font-extrabold uppercase tracking-widest text-accent">Waiting for Buyer Approval</p>
                           <p className="text-[9px] opacity-40 font-bold uppercase mt-2 text-white">Funds are safely locked in the Vault</p>
                        </div>
                      )}

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
