"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ThirdwebProvider } from "thirdweb/react";
import { ToastProvider } from "@/components/Toast";
import { Zap, Lock, Shield, Rocket, Globe, ShieldCheck, Settings, MessageSquare, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("Bug");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [tickerItems, setTickerItems] = useState<any[]>([
    { icon: <Shield size={10} />, text: "SAFE-VAULT PROTOCOL ACTIVE" },
    { icon: <Lock size={10} />, text: "VERIFYING GLOBAL NODES" },
    { icon: <Zap size={10} />, text: "SCANNING FOR NEW LINKS" }
  ]);

  useEffect(() => {
    setMounted(true);
    
    // Activity Ticker Logic
    const channel = supabase.channel('global_activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deals' }, (payload) => {
        const newItem = { 
          icon: <Rocket size={10} />, 
          text: `NEW LINK GENERATED: ${payload.new.safe_link_id.slice(0,8)}...` 
        };
        setTickerItems(prev => [newItem, ...prev.slice(0, 4)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals' }, (payload) => {
        if (payload.new.status === 'Funded') {
          const newItem = { 
            icon: <ShieldCheck size={10} />, 
            text: `DEAL SECURED: ${payload.new.safe_link_id.slice(0,8)}...` 
          };
          setTickerItems(prev => [newItem, ...prev.slice(0, 4)]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackMsg) return;
    setSubmittingFeedback(true);
    
    // Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('feedback').insert([
      { 
        user_id: user?.id,
        category: feedbackCategory,
        message: feedbackMsg
      }
    ]);

    if (!error) {
      alert("Feedback received! Thank you for helping us improve KOVA.");
      setShowFeedbackModal(false);
      setFeedbackMsg("");
    }
    setSubmittingFeedback(false);
  };

  if (!mounted) return <div className="bg-black min-h-screen" />;

  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <Shield size={64} className="text-white/20 mb-8" />
        <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tighter mb-4">
          VAULT <span className="hollow-text">LOCKED</span>
        </h1>
        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest max-w-md">
          The KOVA Protocol is currently undergoing scheduled maintenance or security upgrades. Our systems are secure. We will be back online shortly.
        </p>
      </div>
    );
  }

  return (
    <ThirdwebProvider>
      <ToastProvider>
        {/* GLOBAL HEADER */}
        <header className="fixed top-0 left-0 w-full z-50 mix-blend-difference">
          <div className="flex justify-between items-center px-6 lg:px-12 py-8">
            <Link href="/" className="group">
              <h1 className="text-2xl font-black tracking-tighter leading-none flex items-center gap-2">
                KOVA<span className="text-accent">.</span>
              </h1>
              <p className="text-[8px] font-bold opacity-40 uppercase tracking-[0.4em] mt-1 group-hover:opacity-100 transition-opacity">The Vault Protocol</p>
            </Link>

            <nav className="hidden lg:flex items-center gap-12">
              <Link href="/dashboard" className="text-[9px] font-extrabold uppercase tracking-widest hover:text-accent transition-colors">Vault</Link>
              <Link href="/admin" className="text-[9px] font-extrabold uppercase tracking-widest hover:text-accent transition-colors opacity-40">Arbitration</Link>
              <Link href="/settings" className="text-[9px] font-extrabold uppercase tracking-widest hover:text-accent transition-colors opacity-40 flex items-center gap-2">
                <Settings size={12} /> Access
              </Link>
            </nav>
          </div>
        </header>

        {/* ACTIVITY TICKER */}
        <div className="fixed bottom-0 left-0 w-full z-50 bg-black border-t border-white/5 h-10 flex items-center overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <div key={index} className="flex items-center gap-3 px-8 text-[8px] font-bold uppercase tracking-widest opacity-40 border-r border-white/5">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {children}

        {/* PWA INSTALL BANNER */}
        <AnimatePresence>
          {showInstallBanner && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-20 left-6 right-6 z-[60] bg-white text-black p-6 flex justify-between items-center border border-white/10"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">Install KOVA Protocol</p>
                <p className="text-[9px] opacity-60 uppercase">Add to home screen for faster vault access.</p>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowInstallBanner(false)} className="text-[9px] font-bold uppercase opacity-40">Dismiss</button>
                 <button onClick={handleInstallClick} className="bg-black text-white px-6 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-accent transition-all">Install</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOOTER */}
        <footer className="bg-black py-20 px-12 border-t border-white/5">
           <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="text-center lg:text-left">
                 <h2 className="text-xl font-black mb-2">KOVA<span className="text-accent">.</span></h2>
                 <p className="text-[9px] font-bold opacity-20 uppercase tracking-widest">© 2026 The Vault Protocol. All Rights Reserved.</p>
              </div>
              <div className="flex items-center gap-8">
                 <Link href="/terms" className="text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Terms</Link>
                 <Link href="/privacy" className="text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Privacy</Link>
                 <button 
                  onClick={() => setShowFeedbackModal(true)}
                  className="text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2"
                 >
                   <MessageSquare size={12} /> Support
                 </button>
              </div>
           </div>
        </footer>

        {/* FEEDBACK MODAL */}
        <AnimatePresence>
          {showFeedbackModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                onClick={() => setShowFeedbackModal(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 p-10"
              >
                <div className="flex justify-between items-start mb-8">
                   <h3 className="text-2xl font-black uppercase">Report <br /> <span className="hollow-text">Protocol Issue</span></h3>
                   <button onClick={() => setShowFeedbackModal(false)} className="opacity-20 hover:opacity-100"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                   <div className="flex gap-4">
                      {['Bug', 'Feature', 'Support'].map(cat => (
                        <button 
                          key={cat}
                          onClick={() => setFeedbackCategory(cat)}
                          className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest border transition-all ${feedbackCategory === cat ? 'bg-white text-black border-white' : 'border-white/10 opacity-40'}`}
                        >
                          {cat}
                        </button>
                      ))}
                   </div>
                   <textarea 
                    value={feedbackMsg}
                    onChange={(e) => setFeedbackMsg(e.target.value)}
                    placeholder="DESCRIBE THE ISSUE..."
                    className="w-full bg-white/5 border border-white/10 p-6 text-[11px] font-bold uppercase outline-none focus:border-white h-32"
                   />
                   <button 
                    onClick={submitFeedback}
                    disabled={submittingFeedback || !feedbackMsg}
                    className="w-full bg-white text-black py-4 text-[10px] font-extrabold uppercase tracking-[0.3em] hover:bg-accent hover:text-white transition-all disabled:opacity-20"
                   >
                     {submittingFeedback ? "TRANSMITTING..." : "SUBMIT FEEDBACK"}
                   </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ToastProvider>
    </ThirdwebProvider>
  );
}
