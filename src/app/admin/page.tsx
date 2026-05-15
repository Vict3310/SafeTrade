"use client";
// Force Vercel Redeploy - v1.0.1


import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle, XCircle, ExternalLink, Scale, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { prepareContractCall } from "thirdweb";
import { SAFETRADE_CONTRACT_ADDRESS, SAFETRADE_ABI } from "@/lib/contracts";
import { useToast } from "@/components/Toast";
import { useCallback } from "react";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import { useReadContract, useSendTransaction, useWaitForReceipt } from "thirdweb/react";
import { getContract, toEther } from "thirdweb";
import { client } from "@/lib/thirdweb";
import { celo } from "thirdweb/chains";

const wallets = [
  createWallet("com.opera"), // MiniPay Support
  inAppWallet({
    auth: { options: ["email", "phone", "google"] },
  }),
];

const smartAccountConfig = {
  chain: celo,
  sponsorGas: true,
};

interface Deal {
  id: string | number;
  safe_link_id: string;
  item_name: string;
  price_celo: number;
  price_naira: number;
  status: string;
  buyer_wallet?: string;
  vendor_wallet?: string;
  blockchain_deal_id?: string | number;
}

export default function AdminDashboard() {
  const { showToast } = useToast();
  const [disputedDeals, setDisputedDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Deal[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchUserRole = useCallback(async (address: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .ilike('wallet_address', address)
      .maybeSingle();
    
    if (data) setUserRole(data.role);
    setCheckingRole(false);
  }, []);

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const account = useActiveAccount();

  const contract = getContract({
    client,
    address: SAFETRADE_CONTRACT_ADDRESS,
    chain: celo,
    abi: SAFETRADE_ABI,
  });

  const { data: accumulatedFees, isLoading: loadingFees } = useReadContract({
    contract,
    method: "accumulatedFees",
    params: [],
  });

  const { mutate: sendTransaction, data: transactionResult, isPending: isTxPending } = useSendTransaction();

  const transactionHash = (transactionResult?.transactionHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForReceipt({ 
      chain: celo,
      client,
      transactionHash,
    });

  const fetchDisputes = useCallback(async () => {
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
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    // Search by Safe-Link ID or Wallet
    const { data } = await supabase
      .from('deals')
      .select('*')
      .or(`safe_link_id.ilike.%${query}%,vendor_wallet.ilike.%${query}%,buyer_wallet.ilike.%${query}%`)
      .limit(10);
    
    if (data) setSearchResults(data);
    setIsSearching(false);
  };

  const updateDealStatus = useCallback(async (id: string, status: string) => {
    await supabase
      .from('deals')
      .update({ status })
      .eq('safe_link_id', id);
    fetchDisputes();
  }, [fetchDisputes]);

  useEffect(() => {
    if (account?.address) {
      fetchUserRole(account.address);
      fetchDisputes();
    }

    const channel = supabase
      .channel('admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchDisputes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.address, fetchUserRole, fetchDisputes]);

  useEffect(() => {
    if (isConfirmed && selectedDeal) {
      updateDealStatus(selectedDeal.safe_link_id, "Resolved");
    }
  }, [isConfirmed, selectedDeal, updateDealStatus]);

  const handleResolve = async (winner: 'Buyer' | 'Vendor', blockchainId: string | number) => {
    if (!selectedDeal) return;
    const winnerAddress = winner === 'Buyer' ? selectedDeal.buyer_wallet : selectedDeal.vendor_wallet;

    if (!winnerAddress) {
      showToast("No wallet address found for this party.", "error");
      return;
    }

    try {
      const transaction = prepareContractCall({
        contract,
        method: "resolveDispute",
        params: [BigInt(blockchainId), winnerAddress],
      });
      sendTransaction(transaction);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  const handleWithdrawFees = async () => {
    try {
      const transaction = prepareContractCall({
        contract,
        method: "withdrawFees",
        params: [],
      });
      sendTransaction(transaction);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  if (!account) {
    return (
      <div className="premium-container pt-40 text-center">
        <ShieldAlert size={64} className="mx-auto mb-8 text-white opacity-20" />
        <h2 className="text-4xl font-extrabold uppercase mb-4">ADMIN ACCESS</h2>
        <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest mb-12">Please connect your authorized auditor wallet to enter.</p>
        <div className="flex justify-center">
          <ConnectButton client={client} wallets={wallets} accountAbstraction={smartAccountConfig} />
        </div>
      </div>
    );
  }

  if (loading || checkingRole) return (
    <div className="premium-container pt-32 px-12">
      <Skeleton className="h-16 w-64 mb-16" />
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8">
          <Skeleton className="h-[500px] w-full border border-white/5" />
        </div>
        <div className="col-span-4">
          <Skeleton className="h-[400px] w-full border border-white/5" />
        </div>
      </div>
    </div>
  );

  if (userRole !== 'admin') {
    return (
      <div className="premium-container pt-40 text-center">
        <ShieldAlert size={64} className="mx-auto mb-8 text-red-500 opacity-20" />
        <h2 className="text-4xl font-extrabold uppercase mb-4">ACCESS DENIED</h2>
        <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest mb-12">Only authorized auditors can enter the Arbitration Center.</p>
        <Link href="/dashboard" className="px-8 py-4 border border-white/20 text-[10px] font-extrabold uppercase hover:bg-white hover:text-black">Return to Safety</Link>
      </div>
    );
  }

  return (
    <div className="premium-container pt-32 pb-40">
      <div className="flex justify-between items-end mb-16">
        <div>
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-red-500 mb-4 w-fit">
            <ShieldAlert size={10} /> Internal Conflict Resolution
          </div>
          <h1 className="text-7xl font-extrabold uppercase leading-none">
            TRUST IS <br />
            <span className="text-accent">THE COMMAND</span>
          </h1>
        </div>
        <div className="flex gap-12">
          <div className="text-right">
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Protocol Revenue</p>
            <div className="flex items-center gap-3">
               <p className="text-4xl font-extrabold text-accent">
                 {loadingFees ? "..." : toEther(accumulatedFees || 0n)} <span className="text-[10px] opacity-40">CELO</span>
               </p>
               <button 
                onClick={handleWithdrawFees}
                disabled={!accumulatedFees || accumulatedFees === 0n || isTxPending}
                className="bg-accent text-white px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-20"
               >
                 {isTxPending ? "WITHDRAWING..." : "WITHDRAW"}
               </button>
            </div>
          </div>
          <div className="text-right border-l border-white/10 pl-12">
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Total Disputes</p>
            <p className="text-4xl font-extrabold">{disputedDeals.length}</p>
          </div>
        </div>
      </div>

      {/* GLOBAL SEARCH BAR */}
      <div className="mb-12 relative">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none opacity-20">
          <ShieldAlert size={20} />
        </div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="SEARCH BY SAFE-LINK ID OR WALLET ADDRESS..."
          className="w-full bg-white/5 border border-white/10 py-6 pl-16 pr-8 text-[11px] font-extrabold uppercase tracking-[0.2em] outline-none focus:border-white transition-all"
        />
        {isSearching && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8">
          {searchQuery.length >= 3 && (
            <div className="mb-12 space-y-4">
              <h3 className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">Search Results ({searchResults.length})</h3>
              {searchResults.length === 0 ? (
                <div className="p-12 border border-white/5 text-center opacity-20 text-[10px] font-bold uppercase">No records found.</div>
              ) : (
                searchResults.map((deal) => (
                  <div 
                    key={deal.id}
                    className={`grid grid-cols-12 px-8 py-8 border border-white/10 hover:border-white/30 transition-colors cursor-pointer mb-4 ${selectedDeal?.id === deal.id ? 'bg-white/5 border-white' : 'bg-[#0A0A0A]'}`}
                    onClick={() => setSelectedDeal(deal)}
                  >
                    <div className="col-span-5 flex items-center gap-4">
                       <div className="w-10 h-10 bg-white/5 flex items-center justify-center">
                          <ExternalLink size={16} className="opacity-40" />
                       </div>
                       <div>
                          <p className="font-extrabold uppercase">{deal.item_name}</p>
                          <p className="text-[10px] opacity-40 uppercase tracking-tighter">{deal.status} | {deal.safe_link_id}</p>
                       </div>
                    </div>
                    <div className="col-span-3 flex items-center justify-center font-bold">
                       ₦{deal.price_naira?.toLocaleString()}
                    </div>
                    <div className="col-span-4 text-right flex items-center justify-end">
                       <span className={`text-[9px] font-extrabold uppercase px-3 py-1 border ${deal.status === 'Funded' ? 'border-green-500 text-green-500' : 'border-white/20 opacity-40'}`}>
                          {deal.status}
                       </span>
                    </div>
                  </div>
                ))
              )}
              <div className="h-[1px] bg-white/10 w-full my-12" />
            </div>
          )}

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
                    onClick={() => selectedDeal.blockchain_deal_id && handleResolve('Vendor', selectedDeal.blockchain_deal_id)}
                    className="w-full bg-white text-black py-5 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-3"
                   >
                     <CheckCircle size={14} /> RULE FOR VENDOR
                   </button>
                   <button 
                    onClick={() => selectedDeal.blockchain_deal_id && handleResolve('Buyer', selectedDeal.blockchain_deal_id)}
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
