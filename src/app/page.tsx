"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Zap, ArrowRight, Lock, Globe, CheckCircle2, FileText, Handshake } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero Animations
    const tl = gsap.timeline();
    tl.from(".hero-text", {
      y: 100,
      opacity: 0,
      duration: 1,
      stagger: 0.2,
      ease: "power4.out"
    })
    .from(".structural-line", {
      scaleX: 0,
      duration: 1.5,
      ease: "expo.inOut",
      stagger: 0.1
    }, "-=0.5");

    // Scroll Animations
    const sections = gsap.utils.toArray(".reveal-section");
    sections.forEach((section: any) => {
      gsap.fromTo(section, 
        { y: 100, opacity: 0 },
        {
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse"
          },
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out"
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="relative overflow-hidden bg-primary min-h-screen flex flex-col" ref={containerRef}>
      {/* Premium Noise Overlay */}
      {/* Premium Noise Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-[100] bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E')]"></div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center py-20 lg:py-32 px-4 lg:px-0">
        <div className="premium-container relative z-10">
          <div className="grid grid-cols-12 gap-0">
            <div className="col-span-12 lg:col-span-10">
              <div className="mb-8 overflow-hidden">
                 <motion.div 
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="flex items-center gap-3 bg-accent/10 border border-accent/20 px-4 py-2 text-[8px] lg:text-[10px] font-extrabold uppercase tracking-[0.4em] text-accent w-fit mb-8 lg:mb-12"
                 >
                   <Shield size={12} /> Universal Escrow Infrastructure
                 </motion.div>
              </div>

              <h1 className="hero-text text-[clamp(2.5rem,12vw,12rem)] font-extrabold leading-[0.8] mb-8 lg:mb-12 uppercase tracking-tighter">
                TRUST IS <br />
                <span className="hollow-text">NON-NEGOTIABLE</span>
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="col-span-12 lg:col-span-6">
              <p className="hero-text text-lg lg:text-2xl font-bold uppercase opacity-60 leading-tight mb-12 max-w-xl">
                The definitive trust layer for peer-to-peer commerce. <br />
                Secure high-value transactions with cryptographic certainty.
              </p>
              
              <div className="hero-text flex flex-wrap gap-4 lg:gap-6">
                <Link href="/dashboard">
                  <button className="group relative px-8 lg:px-12 py-6 lg:py-8 bg-accent text-white font-extrabold uppercase tracking-[0.2em] text-[10px] lg:text-[12px] overflow-hidden transition-all hover:scale-[1.02] active:scale-95">
                    <span className="relative z-10 flex items-center gap-3">
                      Launch Dashboard <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  </button>
                </Link>
                <button className="px-8 lg:px-12 py-6 lg:py-8 border border-white/20 font-extrabold uppercase tracking-[0.2em] text-[10px] lg:text-[12px] hover:bg-white hover:text-black transition-all">
                  The Protocol
                </button>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6">
              <div className="hero-text grid grid-cols-2 gap-px bg-white/10 border border-white/10 mx-2 lg:mx-0">
                 {[
                   { label: "Volume Secured", val: "$4.2M+", icon: <Lock size={14} /> },
                   { label: "Global Users", val: "128K", icon: <Zap size={14} /> },
                   { label: "Active Markets", val: "24", icon: <Globe size={14} /> },
                   { label: "Integrity Score", val: "100%", icon: <Shield size={14} /> }
                 ].map((stat, i) => (
                   <div key={i} className="bg-primary p-4 lg:p-8 hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-center gap-2 text-accent mb-3 lg:mb-4 opacity-40 group-hover:opacity-100 transition-opacity">
                        {stat.icon}
                        <span className="text-[8px] lg:text-[9px] font-bold uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <p className="text-xl lg:text-3xl font-extrabold tracking-tighter">{stat.val}</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* Structural Lines */}
        <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 structural-line origin-left"></div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-white/5 structural-line origin-top"></div>
        <div className="absolute bottom-1/4 left-0 w-full h-px bg-white/5 structural-line origin-right"></div>
      </section>

      {/* The Protocol Section */}
      <section className="reveal-section premium-container py-32 border-t border-white/10 relative z-10 bg-primary">
        <div className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.4em] text-accent mb-4 block">How It Works</span>
            <h2 className="text-5xl md:text-7xl font-extrabold uppercase tracking-tighter leading-none">The <br/>Protocol</h2>
          </div>
          <p className="text-sm font-bold opacity-60 uppercase max-w-sm tracking-widest leading-relaxed">
            A deterministic 4-step escrow pipeline ensuring zero-trust execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/10 border border-white/10">
          {[
            { num: "01", title: "Initiate", desc: "Buyer & Seller agree on precise terms.", icon: <Handshake size={24} /> },
            { num: "02", title: "Secure", desc: "Funds locked immutably in the Vault.", icon: <Lock size={24} /> },
            { num: "03", title: "Verify", desc: "Physical or digital fulfillment verified.", icon: <CheckCircle2 size={24} /> },
            { num: "04", title: "Release", desc: "Smart contract executes the payout.", icon: <FileText size={24} /> }
          ].map((step, i) => (
            <div key={i} className="bg-primary p-8 lg:p-12 hover:bg-white/[0.02] transition-all group relative overflow-hidden min-h-[220px]">
              <div className="absolute -right-6 -top-4 text-[90px] lg:text-[120px] font-extrabold hollow-text opacity-5 group-hover:opacity-20 transition-opacity pointer-events-none select-none leading-none">
                {step.num}
              </div>
              <div className="mb-12 text-accent opacity-50 group-hover:opacity-100 transition-opacity">
                {step.icon}
              </div>
              <h3 className="text-2xl font-extrabold uppercase tracking-tight mb-4">{step.title}</h3>
              <p className="text-xs font-bold opacity-50 uppercase tracking-wider leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Vault / Features */}
      <section className="reveal-section premium-container py-32 border-t border-white/10 relative z-10 bg-primary">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <div className="sticky top-32">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.4em] text-accent mb-4 block">Security Model</span>
              <h2 className="text-5xl md:text-8xl font-extrabold uppercase tracking-tighter leading-[0.9] mb-8">
                The <br/><span className="hollow-text">Vault</span>
              </h2>
              <p className="text-sm font-bold opacity-60 uppercase tracking-widest leading-relaxed mb-12">
                Built on top of Celo Sepolia, our smart contracts guarantee that funds are mathematically protected until conditions are met.
              </p>
              <button className="px-8 py-4 border border-white/20 font-extrabold uppercase tracking-[0.2em] text-[10px] hover:bg-white hover:text-black transition-all">
                Audit Reports
              </button>
            </div>
          </div>
          
          <div className="md:col-span-7 flex flex-col gap-px bg-white/10 border border-white/10">
            {[
              { title: "Multi-Sig Security", text: "Requires cryptographic signatures from multiple nodes to authorize exception handling." },
              { title: "Automated Dispute Resolution", text: "Integrated decentralized arbitration to solve conflicts without centralized bias." },
              { title: "Cross-Border Settlement", text: "Fiat-to-Crypto rails allowing seamless international value transfer." }
            ].map((feat, i) => (
              <div key={i} className="bg-primary p-12 lg:p-16 hover:bg-white/[0.02] transition-colors group">
                <h3 className="text-3xl font-extrabold uppercase tracking-tighter mb-4 group-hover:text-accent transition-colors">{feat.title}</h3>
                <p className="text-xs font-bold opacity-50 uppercase tracking-wider leading-relaxed max-w-lg">{feat.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="reveal-section border-t border-white/10 relative z-10 bg-accent text-white mt-20">
        <div className="premium-container py-32 md:py-48 text-center">
          <h2 className="text-[clamp(3rem,10vw,8rem)] font-extrabold uppercase tracking-tighter leading-[0.9] mb-12">
            Ready To <br/>Trade Securely?
          </h2>
          <Link href="/dashboard">
            <button className="px-16 py-8 bg-primary text-white border border-primary font-extrabold uppercase tracking-[0.3em] text-[14px] hover:bg-white hover:text-black transition-all">
              Initialize Connection
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
