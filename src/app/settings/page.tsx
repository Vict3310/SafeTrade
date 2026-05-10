"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Phone, Shield, ArrowLeft, Save, Trash2, CheckCircle, Landmark, CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useActiveAccount } from "thirdweb/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const account = useActiveAccount();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  useEffect(() => {
    if (account?.address) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [account?.address]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('wallet_address', account?.address) // CASE-INSENSITIVE
      .maybeSingle();
    
    if (data) {
      setProfile(data);
      setName(data.full_name || "");
      setPhone(data.phone_number || "");
      setBankName(data.bank_name || "");
      setAccountNumber(data.account_number || "");
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: name, 
        phone_number: phone,
        bank_name: bankName,
        account_number: accountNumber
      })
      .ilike('wallet_address', account.address);

    if (!error) {
      showToast("Profile updated successfully!", "success");
      fetchProfile();
    } else {
      showToast("Error updating profile.", "error");
    }
    setSaving(false);
  };

  const handleWipeData = async () => {
    if (!account?.address) return;
    if (!confirm("CRITICAL WARNING: This will permanently delete your profile and all your Safe-Links. This cannot be undone. Proceed?")) return;

    setLoading(true);
    await supabase.from('deals').delete().eq('vendor_wallet', account.address);
    await supabase.from('profiles').delete().eq('wallet_address', account.address);
    
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  if (loading) return <div className="premium-container pt-40 text-center opacity-20 font-extrabold uppercase tracking-[1em]">Accessing Profile...</div>;

  if (!account) {
    return (
      <div className="premium-container pt-40 text-center">
        <Shield size={64} className="mx-auto mb-8 opacity-20" />
        <h2 className="text-4xl font-extrabold uppercase mb-8">Login Required</h2>
        <Link href="/dashboard" className="px-8 py-4 bg-white text-black text-[10px] font-extrabold uppercase tracking-widest">Connect Vault</Link>
      </div>
    );
  }

  return (
    <div className="premium-container pt-20 lg:pt-32 pb-40">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase hover:opacity-100 transition-opacity mb-8">
          <ArrowLeft size={12} /> Back to Vault
        </Link>
        
        <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tighter mb-16">Profile <span className="hollow-text">Settings</span></h1>

        <div className="space-y-12">
          {/* Role Status */}
          <div className="bg-white/5 border border-white/10 p-8 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Account Role</p>
              <p className="text-xl font-extrabold uppercase tracking-tight">{profile?.role || 'Client'}</p>
            </div>
            <div className={`px-4 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest border ${profile?.role === 'admin' ? 'border-accent text-accent' : 'border-white/20 opacity-40'}`}>
              {profile?.role === 'admin' ? 'Verified Auditor' : 'Standard User'}
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleUpdate} className="space-y-8">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-4">Business / Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-0 top-4 opacity-20" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-4 pl-8 outline-none focus:border-white transition-colors font-bold"
                    placeholder="Enter name"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-4">WhatsApp Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-0 top-4 opacity-20" />
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-4 pl-8 outline-none focus:border-white transition-colors font-bold"
                    placeholder="+234..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-4">Bank Name</label>
                <div className="relative">
                  <Landmark size={16} className="absolute left-0 top-4 opacity-20" />
                  <input 
                    type="text" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-4 pl-8 outline-none focus:border-white transition-colors font-bold"
                    placeholder="e.g. GTBank, Zenith"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-4">Account Number</label>
                <div className="relative">
                  <CreditCard size={16} className="absolute left-0 top-4 opacity-20" />
                  <input 
                    type="text" 
                    value={accountNumber} 
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 py-4 pl-8 outline-none focus:border-white transition-colors font-bold"
                    placeholder="0123456789"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={saving}
              className="w-full bg-white text-black py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-white/90 transition-all flex items-center justify-center gap-2"
            >
              <Save size={16} /> {saving ? "Saving Changes..." : "Update Identity"}
            </button>
          </form>

          {/* Danger Zone */}
          <div className="pt-20 border-t border-white/5">
            <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-[0.4em] mb-8">Danger Zone</h3>
            <div className="bg-red-500/5 border border-red-500/10 p-8 flex flex-col lg:flex-row justify-between items-center gap-6">
              <div className="text-center lg:text-left">
                <p className="text-sm font-bold uppercase mb-1">Delete Account Data</p>
                <p className="text-[10px] opacity-40 font-bold uppercase">This will wipe all links and profile info permanently.</p>
              </div>
              <button 
                onClick={handleWipeData}
                className="px-6 py-3 border border-red-500/30 text-red-500 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
              >
                <Trash2 size={12} /> Wipe Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
