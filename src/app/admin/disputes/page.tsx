"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertCircle, CheckCircle, XCircle, Info, ArrowLeft, ExternalLink, Scale } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { WhatsAppService } from "@/lib/whatsapp";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/components/Toast";

const ADMIN_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Same admin wallet

export default function AdminDisputes() {
  const account = useActiveAccount();
  const { showToast } = useToast();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [allDeals, setAllDeals] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  const fetchMetrics = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select('status, price_naira, service_fee');
    if (!error && data) {
      setAllDeals(data);
    }
  };

  const fetchDisputes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disputes")
      .select(`
        *,
        deals (*, profiles:vendor_id (*))
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDisputes(data);
    }
    setLoading(false);
  };

  const fetchUserRole = async () => {
    if (!account) {
      setCheckingRole(false);
      return;
    }
    
    // First check hardcoded wallet for absolute priority
    if (account.address.toLowerCase() === ADMIN_WALLET.toLowerCase()) {
      setUserRole('admin');
      setCheckingRole(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('wallet_address', account.address)
      .single();
    
    if (!error && data) {
      setUserRole(data.role);
    }
    setCheckingRole(false);
  };

  useEffect(() => {
    fetchDisputes();
    fetchMetrics();
    fetchUserRole();
  }, [account]);

  const resolveDispute = async (status: "Released" | "Refunded") => {
    if (!selectedDispute) return;
    
    // Update the deal status
    const { error: dealError } = await supabase
      .from("deals")
      .update({ status: status })
      .eq("id", selectedDispute.deal_id);

    // Update the dispute status and notes
    const { error: disputeError } = await supabase
      .from("disputes")
      .update({ 
        status: "Resolved",
        admin_notes: adminNotes,
        winner_id: status === "Released" ? selectedDispute.deals.vendor_id : selectedDispute.raised_by
      })
      .eq("id", selectedDispute.id);

    if (!dealError && !disputeError) {
      showToast(`Dispute resolved: ${status === "Released" ? "Funds released via KOVA" : "Funds refunded to Buyer"}`, "success");
      setSelectedDispute(null);
      setAdminNotes("");
      fetchDisputes();
      fetchMetrics();
    } else {
      showToast("Error resolving dispute.", "error");
    }
  };

  if (loading || checkingRole) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Scanning Conflicts...</div>;

  const isAuthorized = account && (userRole === 'admin' || account.address.toLowerCase() === ADMIN_WALLET.toLowerCase());

  if (!isAuthorized) {
    return (
      <div className="premium-container pt-40 text-center">
        <Shield size={64} className="mx-auto mb-8 text-red-500 opacity-20" />
        <h2 className="text-4xl font-extrabold uppercase mb-4">ACCESS DENIED</h2>
        <p className="opacity-40 text-[10px] font-bold uppercase tracking-widest mb-12">Only authorized auditors can enter the Arbitration Center.</p>
        <Link href="/dashboard" className="px-8 py-4 border border-white/20 text-[10px] font-extrabold uppercase hover:bg-white hover:text-black">Return to Safety</Link>
      </div>
    );
  }

  return (
    <div className="premium-container pt-20 lg:pt-32 pb-40">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end items-start gap-8 lg:gap-16 mb-16">
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase hover:opacity-100 transition-opacity mb-4">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tighter leading-none">Arbitration <br className="lg:hidden" /><span className="hollow-text">Center</span></h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
          <div className="bg-white/5 border border-white/10 p-6">
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Total Volume</p>
            <p className="text-2xl font-extrabold">₦{allDeals.reduce((sum, d) => sum + (d.price_naira || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-accent/10 border border-accent/20 p-6 relative group overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Realized Revenue</p>
              <p className="text-2xl font-extrabold text-accent">₦{allDeals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.service_fee || 0), 0).toLocaleString()}</p>
              <button 
                onClick={() => {
                  const amount = allDeals.filter(d => d.status === 'Released').reduce((sum, d) => sum + (d.service_fee || 0), 0);
                  if (amount <= 0) return showToast("No revenue available to withdraw.", "info");
                  showToast(`Payout of ₦${amount.toLocaleString()} initiated to Admin Bank.`, "success");
                }}
                className="mt-4 w-full py-2 bg-accent text-white text-[8px] font-extrabold uppercase tracking-widest hover:bg-white hover:text-black transition-all"
              >
                Withdraw Earnings
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Scale size={80} />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-6">
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Locked in Vault</p>
            <p className="text-2xl font-extrabold">₦{allDeals.filter(d => d.status === 'Funded').reduce((sum, d) => sum + (d.service_fee || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-6">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Active Cases</p>
            <p className="text-2xl font-extrabold text-red-500">{disputes.filter(d => d.status === 'Open').length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Dispute List */}
        <div className="col-span-1 lg:col-span-8 space-y-4">
          {disputes.length === 0 ? (
            <div className="border border-white/5 p-20 text-center">
              <CheckCircle size={48} className="mx-auto mb-4 opacity-10" />
              <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">The Vault is Clean. No active disputes.</p>
            </div>
          ) : (
            disputes.map((dispute) => (
              <motion.div 
                key={dispute.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedDispute(dispute)}
                className={`group border cursor-pointer p-8 transition-all ${selectedDispute?.id === dispute.id ? 'bg-white text-black border-white' : 'bg-[#0A0A0A] border-white/10 hover:border-white/30'}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-8">
                  <div className="col-span-1 flex items-center gap-2">
                    {dispute.status === 'Open' ? <AlertCircle className="text-red-500" /> : <CheckCircle className="text-green-500 opacity-40" />}
                    <span className="lg:hidden text-[10px] font-bold uppercase tracking-widest opacity-40">Case {dispute.id.slice(0,8)}</span>
                  </div>
                  <div className="col-span-1 lg:col-span-7">
                    <p className={`hidden lg:block text-[10px] font-bold uppercase tracking-widest mb-1 ${selectedDispute?.id === dispute.id ? 'opacity-60' : 'opacity-40'}`}>Case ID: {dispute.id.slice(0,8)}</p>
                    <h3 className="text-lg lg:text-xl font-extrabold uppercase">{dispute.deals.item_name}</h3>
                  </div>
                  <div className="col-span-1 lg:col-span-4 text-left lg:text-right flex lg:flex-col justify-between items-baseline">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${selectedDispute?.id === dispute.id ? 'opacity-60' : 'opacity-40'}`}>Value</p>
                    <p className="font-extrabold text-lg">₦{dispute.deals.price_naira?.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Resolution Panel */}
        <div className="col-span-1 lg:col-span-4">
          <div className="lg:sticky lg:top-32 bg-[#0A0A0A] border border-white/10 p-8 lg:p-12 min-h-[400px]">
            {!selectedDispute ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                <Scale size={64} className="mb-6" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Select a case to <br />begin arbitration</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                <div>
                  <h2 className="text-2xl font-extrabold mb-4 uppercase tracking-tight">Case Details</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold opacity-40 uppercase mb-1">Buyer Evidence</p>
                      <p className="text-xs leading-relaxed border-l-2 border-red-500 pl-4 py-2 italic">{selectedDispute.evidence_notes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold opacity-40 uppercase mb-1">Vendor Info</p>
                      <p className="text-xs font-bold uppercase">{selectedDispute.deals.profiles?.full_name || "Unknown Vendor"}</p>
                    </div>
                  </div>
                </div>

                {selectedDispute.status === 'Open' ? (
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-bold opacity-40 uppercase block mb-4">Arbitration Notes</label>
                      <textarea 
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 p-4 text-[11px] min-h-[100px] outline-none focus:border-white transition-colors"
                        placeholder="State your findings..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={async () => {
                          await resolveDispute("Refunded");
                          WhatsAppService.sendUpdate('disputed', { itemName: selectedDispute.deals.item_name, amount: selectedDispute.deals.price_naira, id: selectedDispute.deals.safe_link_id });
                        }}
                        className="bg-red-600 text-white py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle size={14} /> Refund Buyer
                      </button>
                      <button 
                        onClick={async () => {
                          await resolveDispute("Released");
                          WhatsAppService.sendUpdate('released', { itemName: selectedDispute.deals.item_name, amount: selectedDispute.deals.price_naira, id: selectedDispute.deals.safe_link_id });
                        }}
                        className="bg-green-600 text-white py-4 text-[9px] font-extrabold uppercase tracking-widest hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={14} /> Release Funds
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 p-8 text-center">
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">CASE RESOLVED</p>
                    <p className="text-xs opacity-60 italic">"{selectedDispute.admin_notes}"</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
