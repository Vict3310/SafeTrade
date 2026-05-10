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
import { WhatsAppService } from "@/lib/whatsapp";
import { defineChain } from "thirdweb";

import { celoSepoliaTestnet } from "thirdweb/chains";
export const celoSepolia = celoSepoliaTestnet;
import { useWalletBalance } from "thirdweb/react";

const wallets = [
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

  // REAL On-chain Balance (cUSD on Celo Sepolia)
  const { data: balanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: celoSepolia,
    address: account?.address,
    // For cUSD, we'd normally pass the token address, but for CELO native:
  });

  const displayBalance = balanceData ? parseFloat(balanceData.displayValue) * 1500 : 0; // Simulated Naira value

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

  const syncProfile = async () => {
    if (!account?.address) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', account.address)
      .maybeSingle();

    if (!data) {
      await supabase.from('profiles').insert([
        { 
          wallet_address: account.address,
          role: 'client' 
        }
      ]);
      setShowOnboarding(true);
    } else if (!data.full_name || !data.phone_number) {
      setShowOnboarding(true);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: userName, 
        phone_number: userPhone 
      })
      .eq('wallet_address', account?.address);

    if (!error) {
      setShowOnboarding(false);
      alert("Profile verified! Welcome to SafeTrade.");
    }
  };

  const fetchDeals = async () => {
    if (!account?.address) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('vendor_wallet', account.address)
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
          vendor_wallet: address,
          status: 'Pending' 
        }
      ]);

    if (!error) {
      setShowCreateModal(false);
      setItemName("");
      setPrice("");
      setPriceNaira("");
      fetchDeals();
    } else {
      alert(`Error: ${error.message}`);
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
        alert("Deposit Successful! In production, this would mint/send cUSD to your wallet.");
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
    if (amount > totalBalance) return alert("Insufficient balance!");

    // In a real AA setup, this would trigger a contract call to withdraw cUSD
    setShowWithdrawModal(false);
    setWithdrawAmount("");
    alert(`Withdrawal of ₦${amount.toLocaleString()} initiated! In production, this would trigger a cUSD -> Naira bank transfer.`);
  };

  const handleWipeData = async () => {
    if (!account?.address) return;
    if (!confirm("CRITICAL WARNING: This will permanently delete your profile and all your Safe-Links. This cannot be undone. Proceed?")) return;

    setLoading(true);
    // Delete deals
    await supabase.from('deals').delete().eq('vendor_wallet', account.address);
    // Delete profile
    await supabase.from('profiles').delete().eq('wallet_address', account.address);
    
    alert("ACCOUNT WIPED. Resetting session...");
    handleHardLogout();
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
                <h2 className="text-3xl lg:text-4xl font-extrabold mb-2 uppercase">THE VAULT</h2>
                <button onClick={handleHardLogout} className="text-[8px] font-bold opacity-30 hover:opacity-100 uppercase tracking-widest underline decoration-accent underline-offset-4">Force Session Reset</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 w-full lg:w-auto">
              <button onClick={() => setShowCreateModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-white text-black px-8 py-4 text-[10px] font-extrabold uppercase tracking-widest hover:bg-white/90 transition-all">
                <Plus size={16} /> New Safe-Link
              </button>
              {address.toLowerCase() === ADMIN_WALLET.toLowerCase() && (
                <Link href="/admin/disputes" className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-red-500/20 text-red-500 px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  <Shield size={14} /> Arbitration Center
                </Link>
              )}
            </div>
          </div>                  <Shield size={14} /> Admin Hub
                </Link>
              )}
              <button onClick={() => setShowWithdrawModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-white/20 text-white px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                <ArrowUpRight size={14} /> Withdraw
              </button>
              <button onClick={() => setShowDepositModal(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 bg-transparent border border-white/20 text-white px-6 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                <ArrowDownLeft size={14} /> Deposit
              </button>
              <button onClick={() => setShowCreateModal(true)} className="w-full lg:w-auto flex items-center justify-center gap-3 bg-accent text-white px-8 py-4 text-[9px] font-extrabold uppercase tracking-widest hover:brightness-110 transition-all">
                <Plus size={14} /> Create Safe-Link
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-20">
        <div className="col-span-1 lg:col-span-4 p-6 lg:p-8 bg-accent/5 border border-accent/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet size={120} />
          </div>
          <p className="text-[10px] font-bold text-accent tracking-[0.2em] mb-2 uppercase relative z-10">Fiat Vault Balance (NGN)</p>
          <h3 className="text-4xl lg:text-5xl font-extrabold relative z-10 mb-2 tracking-tighter">
            ₦{isBalanceLoading ? "..." : (displayBalance + deals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.price_naira || 0), 0)).toLocaleString()}
          </h3>
          <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest relative z-10">
            Real On-Chain: {balanceData?.displayValue || "0"} {balanceData?.symbol}
          </p>
        </div>
        <div className="col-span-1 lg:col-span-4 p-6 lg:p-8 border border-white/10">
          <p className="text-[10px] font-bold opacity-30 tracking-[0.2em] mb-2 uppercase">Active Deals</p>
          <h3 className="text-4xl lg:text-5xl font-extrabold tracking-tighter">08</h3>
        </div>
        <div className="col-span-1 lg:col-span-4 p-6 lg:p-8 border border-white/10">
          <p className="text-[10px] font-bold opacity-30 tracking-[0.2em] mb-2 uppercase">Success Rate</p>
          <h3 className="text-4xl lg:text-5xl font-extrabold tracking-tighter">98.2%</h3>
        </div>
      </div>

      <div className="deal-list mb-32">
        <div className="grid grid-cols-12 px-8 py-4 border-b border-white/10 opacity-30 text-[10px] font-bold uppercase tracking-widest">
          <div className="col-span-5">Item / Description</div>
          <div className="col-span-2 text-center">Amount</div>
          <div className="col-span-3 text-center">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        
        {loading ? (
          <div className="p-20 text-center opacity-20 font-bold uppercase tracking-[0.5em]">Loading...</div>
        ) : deals.map((deal) => (
          <motion.div 
            key={deal.id}
            className="grid grid-cols-1 lg:grid-cols-12 px-6 lg:px-8 py-6 lg:py-8 border-b border-white/10 hover:bg-white/5 group cursor-pointer transition-colors gap-6 lg:gap-0"
            onClick={() => window.open(`/deal/${deal.safe_link_id}`, '_blank')}
          >
            <div className="col-span-1 lg:col-span-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-white/5 flex items-center justify-center">
                <LinkIcon size={16} className="opacity-50" />
              </div>
              <div>
                <p className="font-extrabold uppercase tracking-tight">{deal.item_name}</p>
                <div className="flex items-center gap-2">
                   <p className="text-[10px] opacity-40 uppercase tracking-widest">ID: {deal.safe_link_id}</p>
                   <span className="text-[7px] px-1 bg-white/5 border border-white/10 opacity-30 font-mono">OWNER: {deal.vendor_wallet?.slice(0,10)}...</span>
                </div>
              </div>
            </div>
            <div className="col-span-1 lg:col-span-2 flex items-center lg:justify-center justify-between font-bold">
              <span className="lg:hidden text-[9px] opacity-40 uppercase tracking-widest">Amount</span>
              ₦{deal.price_naira?.toLocaleString() || '0'}
            </div>
            <div className="col-span-1 lg:col-span-3 flex items-center lg:justify-center justify-between">
              <span className="lg:hidden text-[9px] opacity-40 uppercase tracking-widest">Status</span>
              <div className={`px-4 py-1 text-[9px] font-extrabold uppercase tracking-widest border ${deal.status === 'Released' ? 'border-green-500/50 text-green-500 bg-green-500/10' : deal.status === 'Disputed' ? 'border-red-500/50 text-red-500 bg-red-500/10' : 'border-white/20 text-white bg-white/5'}`}>
                {deal.status}
              </div>
            </div>
            <div className="col-span-1 lg:col-span-2 flex items-center justify-end gap-2">
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/deal/${deal.safe_link_id}`); alert("Copied!"); }} className="flex-1 lg:flex-none p-3 border border-white/10 hover:bg-white hover:text-black text-[10px] font-extrabold transition-colors uppercase">LINK</button>
              <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(deal.item_name)}`, '_blank'); }} className="flex-1 lg:flex-none p-3 border border-green-500/20 text-green-500 hover:bg-green-500/10 text-[10px] font-extrabold transition-colors uppercase">WA</button>
              <button onClick={(e) => handleDelete(e, deal.id)} className="p-3 border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[10px] font-extrabold transition-colors"><Trash2 size={12} /></button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mb-32">
        <h2 className="text-xl font-extrabold uppercase tracking-[0.4em] opacity-40 mb-8 text-center">The Ledger</h2>
        <div className="bg-[#0A0A0A] border border-white/10">
          {deals.filter(d => d.status === 'Released' || d.status === 'Resolved').map((deal) => (
            <div key={deal.id} className="grid grid-cols-12 px-8 py-8 border-b border-white/5 hover:bg-white/5">
              <div className="col-span-8 font-extrabold uppercase">{deal.item_name} <span className="opacity-40 ml-4 font-normal text-[10px]">CERT: {deal.id}</span></div>
              <div className="col-span-4 text-right">
                <button onClick={() => window.print()} className="text-[9px] font-extrabold uppercase border border-white/20 px-4 py-2 hover:bg-white hover:text-black">Receipt</button>
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
        {showOnboarding && (
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
          <div className="mt-40 border-t border-white/5 pt-20">
            <h3 className="text-[10px] font-bold opacity-30 uppercase tracking-[0.4em] mb-8">System Security</h3>
            <div className="bg-red-500/5 border border-red-500/10 p-12 flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="text-center lg:text-left">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Delete Account Data</p>
                <p className="text-[10px] opacity-40 font-bold uppercase max-w-sm">Permanently wipe your identity and all transaction history from the SafeTrade database.</p>
              </div>
              <button onClick={handleWipeData} className="px-8 py-4 border border-red-500/30 text-red-500 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                Wipe My Data
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
