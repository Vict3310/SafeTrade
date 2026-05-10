"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Store, Phone, ShieldCheck, Star, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAccount } from 'wagmi';
import { useToast } from "@/components/Toast";

export default function ProfilePage() {
  const { address } = useAccount();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    phone_number: "",
    shop_name: "",
    wallet_address: ""
  });

  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*, shops(*)')
      .eq('wallet_address', address)
      .single();

    if (!error && data) {
      setProfile({
        full_name: data.full_name || "",
        phone_number: data.phone_number || "",
        shop_name: data.shops?.[0]?.name || "",
        wallet_address: address || ""
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // In a real app, we'd use the authenticated user ID
    // For this prototype, we update by wallet address
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone_number: profile.phone_number,
      })
      .eq('wallet_address', address);

    if (!profileError) {
       showToast("Profile updated successfully!", "success");
    }
    setSaving(false);
  };

  return (
    <div className="premium-container pt-32 pb-40">
      <div className="flex justify-between items-end mb-16">
        <div>
          <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-accent mb-4 w-fit">
            <User size={10} /> Identity Management
          </div>
          <h1 className="text-7xl font-extrabold uppercase leading-none">
            USER <br />
            <span className="hollow-text">PROFILE</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Trust Rating</p>
          <div className="flex items-center gap-1 text-2xl font-extrabold">
            <Star size={20} className="text-yellow-500 fill-yellow-500" /> 5.0
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-4">
           <div className="bg-[#0A0A0A] border border-white/10 p-12 text-center">
              <div className="w-32 h-32 bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-8">
                 <User size={48} className="text-accent" />
              </div>
              <h3 className="text-xl font-extrabold uppercase mb-2">{profile.full_name || "New Trader"}</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-8">{address?.slice(0,6)}...{address?.slice(-4)}</p>
              
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-500 text-[9px] font-extrabold uppercase tracking-widest">
                 <ShieldCheck size={12} /> Wallet Verified
              </div>
           </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
           <form onSubmit={handleSave} className="space-y-12 bg-[#0A0A0A] border border-white/10 p-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">
                       <User size={12} /> Full Name
                    </label>
                    <input 
                      type="text" 
                      value={profile.full_name}
                      onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 py-4 outline-none focus:border-accent transition-colors text-lg font-bold"
                      placeholder="Enter your name"
                    />
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">
                       <Phone size={12} /> Phone Number
                    </label>
                    <input 
                      type="text" 
                      value={profile.phone_number}
                      onChange={(e) => setProfile({...profile, phone_number: e.target.value})}
                      className="w-full bg-transparent border-b border-white/10 py-4 outline-none focus:border-accent transition-colors text-lg font-bold"
                      placeholder="+234..."
                    />
                 </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-widest mb-4">
                   <Store size={12} /> Shop Name
                </label>
                <input 
                  type="text" 
                  value={profile.shop_name}
                  onChange={(e) => setProfile({...profile, shop_name: e.target.value})}
                  className="w-full bg-transparent border-b border-white/10 py-4 outline-none focus:border-accent transition-colors text-lg font-bold"
                  placeholder="e.g. Victor's Electronics"
                />
              </div>

              <button 
                type="submit"
                disabled={saving}
                className="bg-white text-black px-12 py-6 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all flex items-center gap-3 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? "Saving Changes..." : "Update Profile"}
              </button>
           </form>
        </div>
      </div>
    </div>
  );
}
