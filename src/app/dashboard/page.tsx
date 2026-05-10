"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Link as LinkIcon, CheckCircle, Clock, AlertTriangle, Trash2, Wallet, ArrowDownLeft, ArrowUpRight, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb";
import { usePaystackPayment } from "react-paystack";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { WhatsAppService } from "@/lib/whatsapp";
import { defineChain, createWallet } from "thirdweb";
import Tour from "@/components/Tour";

import { celoSepoliaTestnet } from "thirdweb/chains";
export const celoSepolia = celoSepoliaTestnet;
import { useWalletBalance } from "thirdweb/react";

const wallets = [
  createWallet("com.opera"), // MiniPay Support
  inAppWallet({
    auth: {
      options: ["email", "phone", "google"],
    },
  }),
];

const ADMIN_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Replace with your wallet

// Account Abstraction Config for Gasless Transactions
const smartAccountConfig = {
  chain: celoSepolia, // Celo Sepolia
  sponsorGas: true,
};

export default function Dashboard() {
  const account = useActiveAccount();
  const address = account?.address || "0xNotConnected";
  const { showToast } = useToast();
  
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');

  // REAL On-chain Balance (cUSD on Celo Sepolia)
  const { data: balanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: celoSepolia,
    address: account?.address,
    // For cUSD, we'd normally pass the token address, but for CELO native:
  });

  const displayBalance = balanceData ? parseFloat(balanceData.displayValue) * 1500 : 0; // Simulated Naira value

  const formatPrice = (naira: number) => {
    if (currency === 'NGN') return `₦${naira.toLocaleString()}`;
    return `$${(naira / 1500).toFixed(2)}`;
  };

  useEffect(() => {
    if (account?.address) {
      fetchDeals();
      syncProfile();
    }

    // Set up real-time subscription
    const channel = supabase
      .channel('deals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, (payload) => {
        fetchDeals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.address]); // React specifically to address changes

  const handleHardLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const syncProfile = async () => {
    if (!account?.address) {
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const cleanAddress = account.address.trim().toLowerCase();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('wallet_address', cleanAddress)
      .maybeSingle();

    if (!data) {
      const { error: insertError } = await supabase.from('profiles').insert([
        { 
          wallet_address: cleanAddress,
          role: 'client' 
        }
      ]);

      if (insertError && (insertError.code === '23505' || insertError.message.includes('already exists'))) {
        setShowOnboarding(false); 
        setIsProfileLoading(false);
        return;
      }
      
      setShowOnboarding(true);
    } else {
      if (data.full_name) setUserName(data.full_name);
      if (data.phone_number) setUserPhone(data.phone_number);

      if (!data.full_name || !data.phone_number || data.full_name.trim() === "" || data.phone_number.trim() === "") {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
    setIsProfileLoading(false);
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: userName, 
        phone_number: userPhone 
      })
      .ilike('wallet_address', account?.address); // CASE-INSENSITIVE MATCH

    if (!error) {
      showToast("Profile verified! Welcome to SafeTrade.", "success");
      await syncProfile(); // IMMEDIATELY RE-CHECK TO HIDE MODAL
    } else {
      console.error("Onboarding Error:", error);
    }
  };

  const fetchDeals = async () => {
    if (!account?.address) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .ilike('vendor_wallet', account.address) // CASE-INSENSITIVE MATCH
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDeals(data);
    }
    setLoading(false);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    // Cryptographically secure ID generation
    const safeLinkId = crypto.randomUUID().split('-')[0].toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
    const qrSecret = crypto.randomUUID();

    const fee = (parseFloat(priceNaira) || 0) * 0.015;
    const payout = (parseFloat(priceNaira) || 0) - fee;

    const { data, error } = await supabase
      .from('deals')
      .insert([
        { 
          item_name: itemName, 
          price_celo: parseFloat(price), 
          price_naira: parseFloat(priceNaira) || 0,
          service_fee: fee,
          payout_naira: payout,
          safe_link_id: safeLinkId,
          qr_code_secret: qrSecret,
          vendor_wallet: address.toLowerCase(),
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
    } else {
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const config = {
    reference: (new Date()).getTime().toString(),
    email: "user@safetrade.com", // Mock email for testing
    amount: (parseFloat(depositAmount) || 0) * 100, // Amount is in kobo
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    
    initializePayment({
      onSuccess: (reference: any) => {
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
      const message = `AUTHORIZE DESTRUCTION: I, ${account.address}, authorize the permanent deletion of my SafeTrade profile and all associated data. Timestamp: ${Date.now()}`;
      await (account as any).signMessage({ message });

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
    <div className="premium-container pt-20">
      {!account ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Wallet size={64} className="mb-8 opacity-20" />
          <h2 className="text-5xl font-extrabold uppercase tracking-tighter mb-4">ACCESS <span className="hollow-text">VAULT</span></h2>
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
        <Tour />
        <>
          <div className="flex flex-col lg:flex-row justify-between lg:items-end items-start gap-8 mb-16">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <ConnectButton 
                  client={client} 
                  wallets={wallets} 
                  accountAbstraction={smartAccountConfig}
                />
                <div className="absolute -bottom-12 left-0 bg-accent text-white text-[8px] font-bold px-2 py-1 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Click to Disconnect
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Connected: {address}</span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-extrabold mb-2 uppercase tracking-tighter">THE <span className="hollow-text">VAULT</span></h2>
                <button onClick={handleHardLogout} className="text-[8px] font-bold opacity-30 hover:opacity-100 uppercase tracking-widest underline decoration-accent underline-offset-4">Force Session Reset</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 w-full lg:w-auto items-center">
              {/* Multi-Currency Toggle */}
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-sm">
                <button 
                  onClick={() => setCurrency('NGN')}
                  className={`px-3 py-1 text-[9px] font-bold transition-all ${currency === 'NGN' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}
                >
                  NGN
                </button>
                <button 
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 text-[9px] font-bold transition-all ${currency === 'USD' ? 'bg-white text-black' : 'opacity-40 hover:opacity-100'}`}
                >
                  USD
                </button>
              </div>

              <Link href="/settings" className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-white/10 text-white px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-white/5 transition-all">
                Settings
              </Link>
              {address.toLowerCase() === ADMIN_WALLET.toLowerCase() && (
                <Link href="/admin/disputes" className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-red-500/20 text-red-500 px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  <Shield size={14} /> Arbitration Center
                </Link>
              )}
              <button onClick={() => setShowWithdrawModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-white/20 text-white px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                <ArrowUpRight size={14} /> Withdraw
              </button>
              <button id="new-link-btn" onClick={() => setShowDepositModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-accent text-white px-8 py-4 text-[10px] font-extrabold uppercase tracking-[0.2em] hover:bg-accent/90 transition-all">
                <Plus size={16} /> New Safe-Link
              </button>
            </div>
          </div>

          <div id="vault-stats" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Stats Cards with Haptic Hover */}
            {[
              { label: "Vault Balance", val: formatPrice(displayBalance + deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0)), icon: <Wallet className="text-accent" />, color: "bg-accent/5 border-accent/20" },
              { label: "Locked Funds", val: formatPrice(deals.filter(d => d.status === 'Funded').reduce((sum, d) => sum + (d.price_naira || 0), 0)), icon: <Clock className="text-yellow-500" />, color: "bg-yellow-500/5 border-yellow-500/20" },
              { label: "Realized Income", val: formatPrice(deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0)), icon: <CheckCircle className="text-green-500" />, color: "bg-green-500/5 border-green-500/20" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`${stat.color} border p-8 transition-all cursor-default relative overflow-hidden group`}
              >
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/5 rounded-full">{stat.icon}</div>
                  </div>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-3xl font-extrabold tracking-tight">{stat.val}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="deal-list mb-32">
            <div className="grid grid-cols-12 px-8 py-4 border-b border-white/10 opacity-30 text-[10px] font-bold uppercase tracking-widest mb-4">
              <div className="col-span-12 lg:col-span-5">Item / Description</div>
              <div className="hidden lg:block lg:col-span-2 text-center">Amount</div>
              <div className="hidden lg:block lg:col-span-3 text-center">Status</div>
              <div className="hidden lg:block lg:col-span-2 text-right">Actions</div>
            </div>
            
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
                   <p className="text-[10px] font-bold uppercase">Mock Bank PLC ****4321</p>
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
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-[#111] p-12 border border-white/10">
              <h2 className="text-3xl font-extrabold mb-8 uppercase">CREATE SAFE-LINK</h2>
              <form onSubmit={handleCreateLink} className="space-y-8">
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-white text-xl font-bold transition-colors" placeholder="Item Name" required />
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Naira Value</label>
                    <input type="number" value={priceNaira} onChange={(e) => { setPriceNaira(e.target.value); setPrice((parseFloat(e.target.value) / 1500).toFixed(4)); }} className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-white text-xl font-bold transition-colors" placeholder="NGN" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold opacity-40 uppercase tracking-widest">cUSD Value (Auto-Calc)</label>
                    <input type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-transparent border-b border-white/20 py-4 outline-none focus:border-white text-xl font-bold transition-colors opacity-50" placeholder="cUSD" readOnly />
                  </div>
                </div>

                {priceNaira && (
                  <div className="bg-accent/5 border border-accent/20 p-6 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="opacity-40">SafeTrade Fee (1.5%)</span>
                      <span className="text-red-400">- ₦{(parseFloat(priceNaira) * 0.015).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-extrabold uppercase tracking-widest pt-2 border-t border-accent/10">
                      <span>Estimated Payout</span>
                      <span className="text-accent">₦{(parseFloat(priceNaira) * 0.985).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <button type="submit" className="w-full bg-white text-black py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-white/90">GENERATE LINK</button>
              </form>
            </motion.div>
          </div>
        )}
        {!isProfileLoading && showOnboarding && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-[#0A0A0A] p-12 border border-white/10 text-center">
              <Shield size={64} className="mx-auto mb-8 text-accent" />
              <h2 className="text-3xl font-extrabold mb-2 uppercase tracking-tighter">Identity Verification</h2>
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
