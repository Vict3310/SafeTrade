"use client";

import React, { useState, useEffect, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, AlertCircle, ShieldCheck, ExternalLink, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount, useSendTransaction, useWaitForReceipt } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb";
import { WhatsAppService } from "@/lib/whatsapp";
import { getContract, prepareContractCall, readContract, toWei, keccak256, stringToBytes } from "thirdweb";
import { useToast } from "@/components/Toast";
import confetti from "canvas-confetti";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import { useCallback } from "react";
import { EXCHANGE_RATE, SERVICE_FEE_PERCENT } from "@/lib/constants";
import { EmailService } from "@/lib/email";
import { SAFETRADE_CONTRACT_ADDRESS, SAFETRADE_ABI } from "@/lib/contracts";
import { celo } from "thirdweb/chains";

const currentChain = celo;

const wallets = [
  createWallet("com.opera"), // MiniPay Support
  inAppWallet({
    auth: { options: ["email", "phone", "google"] },
  }),
];

const smartAccountConfig = {
  chain: currentChain,
  sponsorGas: true,
};

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const account = useActiveAccount();
  const { showToast } = useToast();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  
  const [deal, setDeal] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dealStatus, setDealStatus] = useState("Pending"); 
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  const { mutate: sendTx, data: transactionResult, isPending: isTxPending } = useSendTransaction();
  
  const transactionHash = (transactionResult?.transactionHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;

  const { isLoading: isConfirmedLoading, isSuccess: isConfirmed } = useWaitForReceipt({
    chain: currentChain,
    client,
    transactionHash,
  });

  const fetchDeal = useCallback(async () => {
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
  }, [id, account?.address]);

  useEffect(() => {
    fetchDeal();

    const channel = supabase.channel(`deal_${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals', filter: `safe_link_id=eq.${id}` }, (payload) => {
        setDeal(payload.new);
        setDealStatus(payload.new.status);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchDeal]);

  useEffect(() => {
    if (isConfirmed && deal && dealStatus === 'Funded') {
      const finalizeRelease = async () => {
         // SIGNATURE CHALLENGE (Issue 2): Proof of intent
         const message = `RELEASE FUNDS: I authorize the release of funds for deal ${id}.`;
         const signature = await account?.signMessage({ message });

         const res = await fetch('/api/deals/release', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             dealId: id,
             signature,
             message,
             wallet: account?.address
           })
         });

         const result = await res.json();

         if (result.success) {
           setDealStatus('Released');
           confetti();
           showToast("FUNDS RELEASED!", "success");
           WhatsAppService.sendUpdate('released', { itemName: deal.item_name, amount: deal.price_naira, id: deal.safe_link_id });
           setTxLoading(false);
         } else {
           showToast(`Release Failed: ${result.error}`, "error");
           setTxLoading(false);
         }
      };
      finalizeRelease();
    }
  }, [isConfirmed, deal, dealStatus, id, showToast]);

    const handleSecureFunds = async () => {
      if (!account?.address) return showToast("Please connect your vault first!", "error");
      if (!deal) return;

      setTxLoading(true);
      try {
        const contract = getContract({
          client,
          address: SAFETRADE_CONTRACT_ADDRESS,
          chain: currentChain,
          abi: SAFETRADE_ABI,
        });

        // Get the next deal ID from the contract
        const currentCount = await readContract({
          contract,
          method: "dealCount",
          params: [],
        });
        const nextId = Number(currentCount) + 1;

        const amountCelo = toWei((deal.price_naira / EXCHANGE_RATE).toFixed(18));
        const itemHash = keccak256(stringToBytes(deal.item_name));

        const transaction = prepareContractCall({
          contract,
          method: "createDeal",
          params: [deal.vendor_wallet, itemHash],
          value: amountCelo,
        });

        sendTx(transaction);
        
        // SECURE ATOMIC UPDATE
        const { data: success, error } = await supabase.rpc('update_deal_status_atomic', {
          target_link_id: id,
          expected_status: 'Pending',
          new_status: 'Funded'
        });

        if (success) {
           // Update metadata (this can be less strict or handled in the RPC later)
           await supabase.from('deals').update({
             buyer_wallet: account.address.toLowerCase(),
             blockchain_deal_id: nextId,
           }).eq('safe_link_id', id);

           setDealStatus('Funded');
           showToast("FUNDS SECURED ON-CHAIN!", "success");
        }
      } catch (err) {
        showToast("Transaction failed.", "error");
      } finally {
        setTxLoading(false);
      }
    };

    const handleReleaseFunds = async () => {
      if (!account?.address) return showToast("Wallet not connected.", "error");
      if (dealStatus !== 'Funded') return showToast("Funds must be in 'Funded' state.", "error");
      if (!deal.blockchain_deal_id) return showToast("Blockchain ID missing. Contact Admin.", "error");
      

      const isBuyer = account.address.toLowerCase() === deal?.buyer_wallet?.toLowerCase();

      if (!isBuyer) return showToast("Unauthorized.", "error");

      setTxLoading(true);
      try {
        // TODO: Implement server-side signature verification and replace direct contract call with API call
        const contract = getContract({
          client,
          address: SAFETRADE_CONTRACT_ADDRESS,
          chain: currentChain,
          abi: SAFETRADE_ABI,
        });

        const transaction = prepareContractCall({
          contract,
          method: "releaseFunds",
          params: [BigInt(deal.blockchain_deal_id)],
        });

        sendTx(transaction);
        // Status update will be handled in a useEffect observing isConfirmed
      } catch (err) {
        showToast("Release failed.", "error");
        setTxLoading(false);
      }
    };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason) return;
    
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
    if (evidenceUrl && !urlRegex.test(evidenceUrl)) {
      return showToast("Please enter a valid URL for evidence.", "error");
    }

    // TODO: Move dispute creation to a secure server API with signature verification
    await supabase.from('deals').update({ status: 'Disputed', evidence_url: evidenceUrl }).eq('safe_link_id', id);
    await supabase.from('disputes').insert([{
      deal_id: deal.id,
      evidence_notes: disputeReason,
      status: 'Open'
    }]);

    EmailService.notifyDisputeRaised({
      dealId: deal.safe_link_id,
      reason: disputeReason,
      itemName: deal.item_name,
      amount: deal.price_naira,
      buyerWallet: account?.address || "Unknown"
    });

    setDealStatus('Disputed');
    setShowDisputeModal(false);
    showToast("Dispute raised. Funds are frozen.", "info");
  };

  if (loading) return (
    <div className="premium-container pt-40 max-w-4xl mx-auto">
      <Skeleton className="h-10 w-64 mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <Skeleton className="h-96 w-full border border-white/5" />
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
  if (!deal) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Deal Not Found</div>;

  return (
    <div className="premium-container pt-20 lg:pt-32 pb-40">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="col-span-1 lg:col-span-7">
          <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tighter mb-8">{deal.item_name}</h1>
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="font-bold uppercase opacity-80 text-[10px]">Item Price</span>
              <span className="text-xl lg:text-2xl font-extrabold">₦{deal.price_naira?.toLocaleString()}</span>
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
        </div>

        <div className="col-span-1 lg:col-span-5">
          <div className="lg:sticky lg:top-32 bg-[#0A0A0A] border border-white/10 p-8 lg:p-12">
            <h2 className="text-xl lg:text-2xl font-extrabold mb-8 uppercase">TRUST IS <span className="text-accent">THE VAULT</span></h2>
            
            {!account ? (
              <div className="text-center py-4">
                <ConnectButton client={client} wallets={wallets} accountAbstraction={smartAccountConfig} />
              </div>
            ) : (
              <div className="space-y-4">
                {dealStatus === 'Pending' && (
                  <button 
                    disabled={txLoading}
                    onClick={handleSecureFunds} 
                    className="w-full bg-accent text-white py-4 font-bold uppercase rounded hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    {txLoading ? <Clock className="animate-spin" /> : <Shield size={18} />}
                    {txLoading ? "Securing..." : "Secure Funds On-Chain"}
                  </button>
                )}

                {dealStatus === 'Funded' && (
                  <div className="space-y-4">
                    <button 
                      disabled={txLoading}
                      onClick={handleReleaseFunds} 
                      className="w-full bg-green-600 text-white py-4 font-bold uppercase rounded hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    >
                      {txLoading ? <Clock className="animate-spin" /> : <Unlock size={18} />}
                      {txLoading ? "Processing..." : profile?.role === 'admin' ? "Admin: Force Release" : "Approve & Release Funds"}
                    </button>
                    
                    {account.address.toLowerCase() === deal.buyer_wallet?.toLowerCase() && (
                      <button onClick={() => setShowDisputeModal(true)} className="w-full border border-red-500/30 text-red-500 py-4 font-bold uppercase rounded hover:bg-red-500/10 transition-all">
                        Raise Dispute
                      </button>
                    )}
                  </div>
                )}

                {dealStatus === 'Released' && (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                    <p className="font-bold uppercase text-green-500">Transaction Complete</p>
                  </div>
                )}

                {dealStatus === 'Disputed' && (
                  <div className="text-center py-8">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                    <p className="font-bold uppercase text-red-500">Funds Frozen / Disputed</p>
                    <p className="text-[10px] opacity-50 mt-2">Arbitration In Progress</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-white/5">
              <div className="flex items-center gap-2 opacity-40 mb-2">
                <Lock size={12} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Vault ID: {deal.safe_link_id}</span>
              </div>
              <p className="text-[10px] opacity-30 leading-relaxed uppercase font-bold">
                Funds are locked in a smart contract. They cannot be moved until the buyer approves or an admin resolves a dispute.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dispute Modal */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDisputeModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-[#111] border border-red-500/30 p-8 lg:p-12">
              <h2 className="text-2xl font-extrabold mb-4 uppercase text-red-500 flex items-center gap-3"><AlertCircle /> RAISE DISPUTE</h2>
              <form onSubmit={handleRaiseDispute} className="space-y-8">
                <textarea 
                  value={disputeReason} 
                  onChange={(e) => setDisputeReason(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 p-4 min-h-[150px] outline-none focus:border-red-500 transition-colors text-sm"
                  placeholder="REASON FOR DISPUTE..."
                  required
                />
                <div>
                   <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Evidence Link (Photo/Video/Drive)</p>
                   <input 
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 p-4 outline-none focus:border-red-500 transition-colors text-sm"
                    placeholder="https://..."
                   />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowDisputeModal(false)} className="flex-1 border border-white/20 py-4 text-[10px] font-extrabold uppercase">Cancel</button>
                  <button type="submit" className="flex-1 bg-red-600 text-white py-4 text-[10px] font-extrabold uppercase">Freeze Funds</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
