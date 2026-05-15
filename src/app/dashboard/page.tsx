"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Link as LinkIcon, CheckCircle, Clock, AlertTriangle, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, Shield, Settings, Power, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb";
import { usePaystackPayment } from "react-paystack";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { WhatsAppService } from "@/lib/whatsapp";
import { EXCHANGE_RATE, SERVICE_FEE_PERCENT } from "@/lib/constants";
import Tour from "@/components/Tour";
import { defineChain } from "thirdweb";
import { createWallet } from "thirdweb/wallets";
import { PriceService } from "@/lib/prices";
import Skeleton from "@/components/Skeleton";
import { useCallback, useMemo } from "react";

import { celo } from "thirdweb/chains";
export const currentChain = celo;
import { useWalletBalance } from "thirdweb/react";

const wallets = [
  createWallet("com.opera"), // MiniPay Support
  inAppWallet({
    auth: {
      options: ["email", "phone", "google"],
    },
  }),
];

// Account Abstraction Config for Gasless Transactions
const smartAccountConfig = {
  chain: currentChain, // Celo Mainnet
  sponsorGas: true,
};

export default function Dashboard() {
  const account = useActiveAccount();
  const address = account?.address || "0xNotConnected";
  const { showToast } = useToast();
  
  const [deals, setDeals] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userBank, setUserBank] = useState("");
  const [userAccount, setUserAccount] = useState("");
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [liveCeloPrice, setLiveCeloPrice] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    const fetchLivePrice = async () => {
      const price = await PriceService.getCeloPriceNGN();
      setLiveCeloPrice(price);
      if (priceNaira && price) {
        setPrice((parseFloat(priceNaira) / price).toFixed(4));
      }
    };
    fetchLivePrice();
  }, [priceNaira]);

  // REAL On-chain Balance (cUSD on Celo Sepolia)
  const { data: balanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: currentChain,
    address: account?.address,
    // For cUSD, we'd normally pass the token address, but for CELO native:
  });

  const displayBalance = balanceData ? parseFloat(balanceData.displayValue) * EXCHANGE_RATE : 0; // Dynamic Naira value

  const formatPrice = (naira: number) => {
    if (currency === 'NGN') return `₦${naira.toLocaleString()}`;
    return `$${(naira / EXCHANGE_RATE).toFixed(2)}`;
  };

  const fetchDeals = useCallback(async () => {
    if (!account?.address) return;
    setLoading(true);
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('vendor_wallet', account.address.toLowerCase())
      .order('created_at', { ascending: false });
    if (data) setDeals(data);
    setLoading(false);
  }, [account?.address]);

  const syncProfile = useCallback(async () => {
    if (!account?.address) {
      setIsProfileLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('wallet_address', account.address)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
      setUserName(data.full_name || "");
      setUserPhone(data.phone_number || "");
      if (!data.full_name || !data.phone_number) {
        setShowOnboarding(true);
      }
    } else {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert([{ wallet_address: account.address.toLowerCase(), role: 'client' }])
        .select()
        .single();
      if (newProfile) setProfile(newProfile);
      setShowOnboarding(true);
    }
    setIsProfileLoading(false);
  }, [account?.address]);

  useEffect(() => {
    if (account?.address) {
      fetchDeals();
      syncProfile();
    }

    const channel = supabase
      .channel('deals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchDeals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.address]); 

  const handleHardLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    // Issue 23: Phone Validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(userPhone)) {
      return showToast("Please enter a valid international phone number (e.g., +234...)", "error");
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: userName, 
        phone_number: userPhone 
      })
      .ilike('wallet_address', account.address);

    if (!error) {
      showToast("Profile verified! Welcome to KOVA.", "success");
      await syncProfile(); 
    } else {
      console.error("Onboarding Error:", error);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown) return showToast("Please wait 30 seconds between link creations.", "error");
    const safeLinkId = crypto.randomUUID();
    const qrSecret = crypto.randomUUID();

    // Use live price or fallback
    const currentPrice = liveCeloPrice || 1350;
    const calculatedCelo = parseFloat(priceNaira) / currentPrice;

    const fee = (parseFloat(priceNaira) || 0) * 0.015;
    const payout = (parseFloat(priceNaira) || 0) - fee;

    const { error } = await supabase
      .from('deals')
      .insert([
        { 
          item_name: itemName, 
          price_celo: calculatedCelo, 
          price_naira: parseFloat(priceNaira) || 0,
          service_fee: fee,
          payout_naira: payout,
          safe_link_id: safeLinkId,
          qr_code_secret: qrSecret,
          vendor_wallet: address.toLowerCase(),
          vendor_id: profile?.id,
          status: 'Pending' 
        }
      ]);

    if (!error) {
      showToast("Safe-Link Created Successfully!", "success");
      setShowCreateModal(false);
      setItemName("");
      setPrice("");
      setPriceNaira("");
      fetchDeals();
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
    } else {
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const paystackConfig = useMemo(() => ({
    reference: (new Date()).getTime().toString(),
    email: "user@kova.com",
    amount: (parseFloat(depositAmount) || 0) * 100,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  }), [depositAmount]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    initializePayment({
      onSuccess: () => {
        showToast("Deposit Successful! Wallet updated.", "success");
        setShowDepositModal(false);
        setDepositAmount("");
      },
      onClose: () => {
        console.log("Deposit modal closed");
      }
    });
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    const totalBalance = displayBalance + deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0);
    
    if (!amount || amount <= 0) return;
    if (amount > totalBalance) return showToast("Insufficient balance!", "error");

    // In a real AA setup, this would trigger a contract call to withdraw cUSD
    setShowWithdrawModal(false);
    setWithdrawAmount("");
    showToast(`Withdrawal of ₦${amount.toLocaleString()} initiated!`, "info");
  };

  const handleWipeData = async () => {
    if (!account?.address) return;
    if (!confirm("CRITICAL WARNING: This will permanently delete your profile and all your Safe-Links. This cannot be undone. You will be asked to sign to authorize this destruction.")) return;

    try {
      setLoading(true);
      
      // DESTRUCTION CHALLENGE: Sign to authorize data wipe
      const message = `AUTHORIZE DESTRUCTION: I, ${account.address}, authorize the permanent deletion of my KOVA profile and all associated data. Timestamp: ${Date.now()}`;
      await account.signMessage({ message });

      // Delete deals
      await supabase.from('deals').delete().eq('vendor_wallet', account.address.toLowerCase());
      // Delete profile
      await supabase.from('profiles').delete().eq('wallet_address', account.address.toLowerCase());
      
      showToast("ACCOUNT WIPED. Resetting session...", "info");
      handleHardLogout();
    } catch (err) {
      showToast("Destruction Cancelled: Authorization failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this deal?")) return;
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (!error) fetchDeals();
  };


  return (
    <div className="pt-20">
      {!account ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Wallet size={64} className="mb-8 opacity-20" />
          <h2 className="text-5xl font-extrabold uppercase tracking-tighter mb-4">ACCESS <span className="hollow-text">THE VAULT</span></h2>
          <p className="opacity-50 text-sm font-bold tracking-widest uppercase mb-12 max-w-md">
            Sign in with your email or phone number. A secure Celo wallet will be generated automatically.
          </p>
          <ConnectButton 
            client={client} 
            wallets={wallets} 
            accountAbstraction={smartAccountConfig}
          />
        </div>
      ) : (
        <>
          <Tour />
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-8 mb-16 px-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative group">
                <ConnectButton 
                  client={client} 
                  wallets={wallets} 
                  accountAbstraction={smartAccountConfig}
                />
              </div>
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em]">Live Connection: {address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">TRUST IS <span className="text-accent">THE PROTOCOL</span></h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3">
              {/* Discrete Currency Toggle */}
              <div className="flex bg-black/40 border border-white/10 p-1 rounded-full mr-2">
                <button 
                  onClick={() => setCurrency('NGN')}
                  className={`px-4 py-1.5 text-[9px] font-black rounded-full transition-all ${currency === 'NGN' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}
                >
                  NGN
                </button>
                <button 
                  onClick={() => setCurrency('USD')}
                  className={`px-4 py-1.5 text-[9px] font-black rounded-full transition-all ${currency === 'USD' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}
                >
                  USD
                </button>
              </div>

              {/* Action Icons */}
              <div className="flex gap-2">
                {/* Admin Access (Secure RBAC) */}
                {profile?.role === 'admin' && (
                  <Link href="/admin/disputes" title="Arbitration Center" className="w-10 h-10 rounded-full flex items-center justify-center border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                    <Shield size={16} />
                  </Link>
                )}
                <button onClick={() => setShowWithdrawModal(true)} title="Withdraw Earnings" className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 hover:bg-white hover:text-black transition-all">
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={handleHardLogout} title="Force Reset Session" className="w-10 h-10 rounded-full flex items-center justify-center border border-red-500/10 text-red-500/40 hover:bg-red-500 hover:text-white transition-all">
                  <Power size={16} />
                </button>
              </div>

              <button id="new-link-btn" onClick={() => setShowDepositModal(true)} className="flex items-center gap-3 bg-accent text-white px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent/90 transition-all">
                <Plus size={16} /> New Safe-Link
              </button>
            </div>
          </div>

          <div id="vault-stats" className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-16">
            {/* Stats Cards: Compact & Pill-Shaped */}
            {[
              { label: "Balance", val: displayBalance + deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0), icon: <Wallet size={12} className="text-accent" />, color: "bg-accent/5 border-accent/20" },
              { label: "Locked", val: deals.filter(d => d.status === 'Funded').reduce((sum, d) => sum + (d.price_naira || 0), 0), icon: <Clock size={12} className="text-yellow-500" />, color: "bg-yellow-500/5 border-yellow-500/20" },
              { label: "Income", val: deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0), icon: <CheckCircle size={12} className="text-green-500" />, color: "bg-green-500/5 border-green-500/20" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                whileHover={{ scale: 1.02 }}
                className={`${stat.color} px-5 py-3 rounded-full border backdrop-blur-sm flex items-center justify-between gap-3 transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full">
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-[8px] font-black opacity-40 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                    <h3 className="text-sm font-black tracking-tight leading-none">{formatPrice(stat.val)}</h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* DEAL LISTING */}
          <div className="space-y-4">
            {loading ? (
              // Skeleton Loaders
              [1, 2, 3].map(i => (
                <div key={i} className="h-24 w-full skeleton mb-4 border border-white/5" />
              ))
            ) : deals.length === 0 ? (
              // Beautiful Empty State
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-32 border border-white/5 border-dashed flex flex-col items-center justify-center text-center"
              >
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 opacity-20">
                  <LinkIcon size={32} />
                </div>
                <h4 className="text-xl font-extrabold uppercase mb-2">No Safe-Links Found</h4>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest max-w-xs leading-relaxed">
                  Start your first high-trust transaction by creating a secure escrow link for your customer.
                </p>
                <button onClick={() => setShowCreateModal(true)} className="mt-8 px-8 py-4 border border-white/20 text-[10px] font-extrabold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                  Create First Link
                </button>
              </motion.div>
            ) : (
              deals.map((deal) => (
                <motion.div 
                  key={deal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 5 }}
                  onClick={() => window.location.href = `/deal/${deal.safe_link_id}`}
                  className="bg-white/5 border border-white/10 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 items-center gap-6 cursor-pointer group hover:bg-white/10 transition-all mb-4 relative overflow-hidden"
                >
                  <div className="col-span-12 lg:col-span-5 flex items-center gap-4">
                    <div className={`p-3 rounded-full ${deal.status === 'Funded' ? 'bg-accent/20 text-accent relative' : 'bg-white/5 opacity-40'}`}>
                      <LinkIcon size={18} />
                      {deal.status === 'Funded' && <div className="absolute inset-0 bg-accent rounded-full animate-ping opacity-20"></div>}
                    </div>
                    <div>
                      <span className="text-[10px] opacity-40 font-bold tracking-[0.2em] mt-1 uppercase">THE VAULT PROTOCOL</span>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">ID: {deal.safe_link_id.slice(0,8)}</p>
                      <h4 className="text-lg font-extrabold uppercase group-hover:text-accent transition-colors">{deal.item_name}</h4>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-2 flex lg:flex-col justify-between items-baseline">
                    <span className="lg:hidden text-[9px] opacity-40 uppercase tracking-widest">Amount</span>
                    <p className="font-extrabold text-lg">{formatPrice(deal.price_naira || 0)}</p>
                  </div>
                  <div className="col-span-12 lg:col-span-3 flex lg:flex-col justify-between items-baseline">
                    <span className="lg:hidden text-[9px] opacity-40 uppercase tracking-widest">Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${deal.status === 'Funded' ? 'bg-accent animate-pulse' : deal.status === 'Released' ? 'bg-green-500' : 'bg-white/20'}`} />
                      <span className={`text-[11px] font-black uppercase tracking-widest ${deal.status === 'Funded' ? 'text-accent' : deal.status === 'Released' ? 'text-green-500' : 'opacity-40'}`}>
                        {deal.status}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-2 flex items-center justify-end gap-2">
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/deal/${deal.safe_link_id}`); showToast("Safe-Link Copied!", "info"); }} className="flex-1 lg:flex-none p-3 border border-white/10 hover:bg-white hover:text-black text-[10px] font-extrabold transition-colors uppercase">LINK</button>
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(deal.item_name)}`, '_blank'); }} className="flex-1 lg:flex-none p-3 border border-green-500/20 text-green-500 hover:bg-green-500/10 text-[10px] font-extrabold transition-colors uppercase">WA</button>
                    <button onClick={(e) => handleDelete(e, deal.id)} className="p-3 border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[10px] font-extrabold transition-colors"><Trash2 size={12} /></button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div id="ledger-section" className="mb-32">
            <h2 className="text-xl font-extrabold uppercase tracking-[0.4em] opacity-40 mb-8 text-center">The Ledger</h2>
            <div className="bg-[#0A0A0A] border border-white/10">
              {deals.filter(d => d.status === 'Released' || d.status === 'Resolved').map((deal) => (
                <div key={deal.id} className="grid grid-cols-12 px-8 py-8 border-b border-white/5 hover:bg-white/5 group">
                  <div className="col-span-8 font-extrabold uppercase group-hover:text-accent transition-colors">{deal.item_name} <span className="opacity-40 ml-4 font-normal text-[10px]">CERT: {deal.id}</span></div>
                  <div className="col-span-4 text-right">
                    <button onClick={() => window.print()} className="text-[9px] font-extrabold uppercase border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-all">Receipt</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

      {/* Modals */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowWithdrawModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#111] p-12 border border-white/10">
              <h2 className="text-3xl font-extrabold mb-2 uppercase text-accent">Withdraw Funds</h2>
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-8">Funds will be sent to your verified bank account.</p>
              
              <form onSubmit={handleWithdraw} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold opacity-40 tracking-[0.2em] uppercase block mb-2">Withdrawal Amount (NGN)</label>
                  <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-accent text-3xl font-extrabold tracking-tighter" placeholder="0" required />
                </div>

                <div className="bg-white/5 p-4 border border-white/10">
                   <p className="text-[8px] font-bold opacity-40 uppercase tracking-[0.2em] mb-1">Destination Bank</p>
                   <p className="text-[10px] font-bold uppercase">{userBank ? `${userBank} ****${userAccount.slice(-4)}` : "No Bank Configured (Go to Settings)"}</p>
                </div>
                
                <button type="submit" className="w-full bg-accent text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:brightness-110 flex justify-center items-center gap-2">
                  <ArrowUpRight size={16} /> Withdraw Now
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDepositModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#111] p-12 border border-white/10">
              <h2 className="text-3xl font-extrabold mb-2 uppercase">Deposit Naira</h2>
              <p className="text-xs font-bold opacity-50 uppercase tracking-widest mb-8">Funds instantly convert to stablecoins in your hidden wallet.</p>
              
              <form onSubmit={handleDeposit} className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold opacity-40 tracking-[0.2em] uppercase block mb-2">Amount (NGN)</label>
                  <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-accent text-3xl font-extrabold tracking-tighter" placeholder="0" required />
                </div>
                
                <button type="submit" className="w-full bg-accent text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:brightness-110 flex justify-center items-center gap-2">
                  <ArrowDownLeft size={16} /> Pay via Paystack
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[#0A0A0A] p-12 border border-white/10 text-center">
              <h2 className="text-3xl font-extrabold mb-2 uppercase">Identity Verification</h2>
              <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-12">Complete your auditor profile to begin trading.</p>
              
              <form onSubmit={handleOnboarding} className="space-y-8 text-left">
                <div>
                  <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-2">Full Business Name</label>
                  <input 
                    type="text" 
                    value={userName} 
                    onChange={(e) => setUserName(e.target.value)} 
                    className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-accent text-lg font-bold" 
                    placeholder="E.g. Global Tech Hub" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-2">WhatsApp Number</label>
                  <input 
                    type="text" 
                    value={userPhone} 
                    onChange={(e) => setUserPhone(e.target.value)} 
                    className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-accent text-lg font-bold" 
                    placeholder="+234..." 
                    required 
                  />
                </div>
                <button type="submit" className="w-full bg-accent text-white py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:brightness-110">Initialize Profile</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}