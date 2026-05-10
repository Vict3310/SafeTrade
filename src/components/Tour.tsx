"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, HelpCircle } from "lucide-react";

const steps = [
  {
    target: "new-link-btn",
    title: "Create Your First Deal",
    content: "Start here to generate a secure escrow link for your buyer. No login required for them!"
  },
  {
    target: "vault-stats",
    title: "Track Your Wealth",
    content: "Monitor your locked funds and realized income in real-time as transactions progress."
  },
  {
    target: "ledger-section",
    title: "The Immutable Ledger",
    content: "Every successful transaction is recorded here with a downloadable receipt."
  }
];

export default function Tour() {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("hasSeenSafeTradeTour");
    if (!hasSeenTour) {
      setTimeout(() => setShowTour(true), 2000);
      setActiveStep(0);
    }
  }, []);

  const handleNext = () => {
    if (activeStep !== null && activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setShowTour(false);
    setActiveStep(null);
    localStorage.setItem("hasSeenSafeTradeTour", "true");
  };

  if (!showTour || activeStep === null) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto"
          onClick={handleClose}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white text-black p-8 shadow-2xl pointer-events-auto"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="p-2 bg-accent/10 text-accent">
              <HelpCircle size={20} />
            </div>
            <button onClick={handleClose} className="opacity-20 hover:opacity-100 transition-opacity">
              <X size={20} />
            </button>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-2">Step {activeStep + 1} of {steps.length}</p>
          <h3 className="text-2xl font-extrabold uppercase mb-4 tracking-tighter leading-none">{steps[activeStep].title}</h3>
          <p className="text-sm opacity-60 leading-relaxed mb-8">{steps[activeStep].content}</p>

          <button 
            onClick={handleNext}
            className="w-full bg-black text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-accent transition-colors"
          >
            {activeStep === steps.length - 1 ? "Finish Tour" : "Next Step"} <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
