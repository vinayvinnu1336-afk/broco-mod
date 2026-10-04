'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Wrench, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Car, 
  Gauge, 
  Sparkles, 
  Award, 
  PhoneCall, 
  ChevronRight, 
  Star, 
  Search,
  CheckCircle,
  HelpCircle,
  Headphones,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function HomePage() {
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResult, setTrackResult] = useState<string | null>(null);

  const services = [
    {
      icon: <Gauge className="w-6 h-6 text-electric-600" />,
      title: 'Periodic Scheduled Service',
      desc: 'Comprehensive multi-point inspection, synthetic engine oil change, and filter replacements.',
      price: 'From $149',
    },
    {
      icon: <SlidersHorizontal className="w-6 h-6 text-electric-600" />,
      title: 'Diagnostics & Electricals',
      desc: 'Computerized OBD-II scans, sensor diagnostics, ECM analysis, and battery health checks.',
      price: 'From $79',
    },
    {
      icon: <Car className="w-6 h-6 text-electric-600" />,
      title: 'Brakes & Suspension',
      desc: 'Brake pad renewal, disc rotor resurfacing, strut overhaul, and bushing replacements.',
      price: 'From $119',
    },
    {
      icon: <Wrench className="w-6 h-6 text-electric-600" />,
      title: 'Engine & Transmission Tuning',
      desc: 'Timing belt servicing, clutch overhaul, gearbox fluid flushing, and spark plug renewal.',
      price: 'From $199',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-electric-600" />,
      title: 'Air Conditioning & Climate',
      desc: 'R134a/R1234yf refrigerant recharge, compressor testing, cabin filter change, and leak detection.',
      price: 'From $89',
    },
    {
      icon: <Award className="w-6 h-6 text-electric-600" />,
      title: 'Bodywork, Denting & Painting',
      desc: 'Computerized paint matching, ceramic clear coat finish, and insurance claim assistance.',
      price: 'Custom Quote',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Book Service Online',
      desc: 'Select your vehicle model, describe your service need or symptoms, and set your location.',
    },
    {
      num: '02',
      title: '10 KM Verified Matching',
      desc: 'Our spatial matching algorithm connects you to accredited garages within a 10 km radius.',
    },
    {
      num: '03',
      title: 'Advisor Review & Fixed Quote',
      desc: 'A dedicated automotive advisor reviews competitive workshop quotes to ensure fair pricing.',
    },
    {
      num: '04',
      title: 'Live Tracking & Handover',
      desc: 'Track inspection notes, active technician milestones, and approve extra work transparently.',
    },
  ];

  const faqs = [
    {
      q: 'How does BroCo Mod guarantee transparent pricing?',
      a: 'Garages submit competitive quotes to a certified BroCo Mod Service Advisor. The advisor reviews labor and parts rates, ensures OEM/OES compliance, and issues an itemized customer quotation with zero hidden markups.',
    },
    {
      q: 'How does the 10 KM garage radius work?',
      a: 'We use geospatial indexing (PostGIS) to identify verified workshops within a 10 km radius of your location, guaranteeing convenient access, shorter turnaround, and prompt doorstep pick-up.',
    },
    {
      q: 'Can I track work in progress while my car is at the workshop?',
      a: 'Yes. Once your vehicle is received, technicians log inspection results, work progress, and status photos directly in the portal. You can view live milestone progress from your phone or desktop.',
    },
    {
      q: 'What happens if the garage finds additional issues during inspection?',
      a: 'Garages cannot charge for additional work without your explicit digital consent. Any additional work requests are reviewed by your Advisor and sent to you as a separate approval request before work begins.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50 font-sans text-navy-900">
      {/* 1. Global Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-surface-200 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-navy-900 flex items-center justify-center text-white shadow-md shadow-navy-900/20 group-hover:bg-electric-600 transition-colors">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center">
                <span className="text-xl font-black tracking-tight text-navy-900 uppercase">BroCo</span>
                <span className="text-xl font-light tracking-widest text-electric-600 uppercase ml-1">Mod</span>
              </div>
              <span className="text-[10px] text-navy-400 font-semibold tracking-wider uppercase block">
                Automotive Service Platform
              </span>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-navy-700">
            <Link href="/" className="text-electric-600 hover:text-electric-700 transition">
              Home
            </Link>
            <a href="#services" className="hover:text-electric-600 transition">
              Services
            </a>
            <button
              onClick={() => setTrackModalOpen(true)}
              className="hover:text-electric-600 transition font-semibold"
            >
              Track Service
            </button>
            <a href="#how-it-works" className="hover:text-electric-600 transition">
              How It Works
            </a>
            <a href="#why-us" className="hover:text-electric-600 transition">
              Why BroCo Mod
            </a>
            <a href="#faq" className="hover:text-electric-600 transition">
              Support
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <a
              href="tel:18002762666"
              className="hidden sm:flex items-center gap-2 text-xs font-bold text-navy-700 hover:text-electric-600 transition bg-surface-100 px-3.5 py-2 rounded-xl border border-surface-200"
            >
              <PhoneCall className="w-4 h-4 text-electric-600" />
              <span>1-800-BROCO-MOD</span>
            </a>

            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/customer/requests/new">
                <Button variant="primary" size="sm">
                  Book Service
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-surface-50 to-surface-100 py-16 sm:py-24 border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-electric-50 border border-electric-200 text-electric-700 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-electric-600" />
                <span>Verified Workshops • Transparent Pricing • Live Status</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-navy-900 tracking-tight leading-[1.1]">
                Your Vehicle, <br />
                <span className="text-electric-600">Our Responsibility.</span>
              </h1>

              <p className="text-base sm:text-lg text-navy-600 max-w-xl leading-relaxed">
                Professional vehicle servicing with verified garages, transparent communication, and complete service tracking from booking to handover.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link href="/customer/requests/new">
                  <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-5 h-5" />}>
                    Book a Service
                  </Button>
                </Link>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setTrackModalOpen(true)}
                  leftIcon={<Search className="w-5 h-5 text-electric-600" />}
                >
                  Track My Vehicle
                </Button>
              </div>

              {/* Key Trust Signals */}
              <div className="pt-6 grid grid-cols-3 gap-6 border-t border-surface-200/80">
                <div>
                  <div className="text-2xl font-black text-navy-900">500+</div>
                  <div className="text-xs font-semibold text-navy-500 mt-0.5">Verified Workshops</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-navy-900">10 KM</div>
                  <div className="text-xs font-semibold text-navy-500 mt-0.5">Smart Proximity Radius</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-navy-900">100%</div>
                  <div className="text-xs font-semibold text-navy-500 mt-0.5">Price Transparency</div>
                </div>
              </div>
            </div>

            {/* Right Automotive Service Visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Main Visual Card */}
                <div className="bg-navy-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl shadow-navy-950/20 border border-navy-800 relative overflow-hidden">
                  {/* Subtle Background Glow */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-electric-600/20 rounded-full blur-3xl pointer-events-none" />

                  {/* Header in Card */}
                  <div className="flex items-center justify-between border-b border-navy-800 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-electric-600/30 border border-electric-500/40 flex items-center justify-center text-electric-300">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-mono text-electric-400">ACTIVE WORKFLOW</div>
                        <div className="text-sm font-bold text-white">Live Service Monitor</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold">
                      IN PROGRESS
                    </span>
                  </div>

                  {/* Mock Vehicle Details */}
                  <div className="bg-navy-800/80 rounded-2xl p-4 border border-navy-700/60 mb-6 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-surface-300">Vehicle:</span>
                      <span className="font-bold text-white">2023 BMW 330i M-Sport</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-surface-300">Assigned Garage:</span>
                      <span className="font-bold text-electric-300">Apex Performance Autocare</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-surface-300">Service Advisor:</span>
                      <span className="font-bold text-white">Marcus Vance (Certified)</span>
                    </div>
                  </div>

                  {/* Step Progression Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-surface-200">Vehicle Inspection Completed (32 Points)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-surface-200">Customer Approved Quotation (#Q-8821)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="w-4 h-4 rounded-full border-2 border-electric-400 border-t-transparent animate-spin shrink-0" />
                      <span className="text-white font-bold">Work In Progress — Brake Rotor Servicing</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs opacity-60">
                      <div className="w-4 h-4 rounded-full border border-surface-400 shrink-0" />
                      <span className="text-surface-300">Quality Check & Handover Scheduled</span>
                    </div>
                  </div>

                  {/* Bottom badge */}
                  <div className="mt-6 pt-4 border-t border-navy-800 flex items-center justify-between text-xs text-surface-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-electric-400" />
                      <span>Ready by Today, 5:30 PM</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">100% Escrow Protected</span>
                  </div>
                </div>

                {/* Floating Trust Badge */}
                <div className="hidden sm:flex absolute -bottom-5 -left-6 bg-white p-3.5 rounded-2xl border border-surface-200 shadow-xl items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy-900">Zero Hidden Costs</div>
                    <div className="text-[11px] text-navy-500">Every quote pre-approved by Advisor</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Service Catalog Section */}
      <section id="services" className="py-20 bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">
              Comprehensive Automotive Services
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-navy-900 tracking-tight mt-2">
              Everything Your Vehicle Needs, Under One Roof
            </h2>
            <p className="text-sm text-navy-600 mt-3 leading-relaxed">
              From routine maintenance to intricate transmission overhauls, our network of accredited workshops provides certified care with transparent warranties.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <Card key={svc.title} hoverEffect className="p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-electric-50 border border-electric-100 flex items-center justify-center mb-5">
                    {svc.icon}
                  </div>
                  <h3 className="text-lg font-bold text-navy-900 mb-2">{svc.title}</h3>
                  <p className="text-xs text-navy-600 leading-relaxed mb-6">{svc.desc}</p>
                </div>
                <div className="pt-4 border-t border-surface-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-navy-900">{svc.price}</span>
                  <Link
                    href="/customer/requests/new"
                    className="text-xs font-bold text-electric-600 hover:text-electric-700 flex items-center gap-1 group"
                  >
                    <span>Book Now</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="py-20 bg-surface-50 border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">
              Seamless 4-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-navy-900 tracking-tight mt-2">
              How BroCo Mod Works
            </h2>
            <p className="text-sm text-navy-600 mt-3 leading-relaxed">
              We eliminate traditional garage uncertainty with smart proximity matching, professional quote curation, and real-time digital milestones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => (
              <div
                key={step.num}
                className="bg-white p-6 rounded-2xl border border-surface-200 shadow-card flex flex-col justify-between"
              >
                <div>
                  <div className="text-3xl font-black text-electric-600/30 mb-3">{step.num}</div>
                  <h3 className="text-base font-bold text-navy-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-navy-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Why BroCo Mod Section */}
      <section id="why-us" className="py-20 bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">
                The BroCo Mod Advantage
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-navy-900 tracking-tight">
                Built to Solve Every Automotive Servicing Pain Point
              </h2>
              <p className="text-sm text-navy-600 leading-relaxed">
                Car repair shouldn&apos;t involve guesswork, surprise bills, or dubious parts. BroCo Mod acts as your trusted automotive advocate at every step.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-electric-50 text-electric-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Vetted & Accredited Workshops Only</h4>
                    <p className="text-xs text-navy-600 mt-0.5">
                      Every garage in our network undergoes comprehensive tool, capability, and technician verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-electric-50 text-electric-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Dedicated Service Advisor Protection</h4>
                    <p className="text-xs text-navy-600 mt-0.5">
                      An independent automotive engineer audits estimates to ensure you are never overcharged for unnecessary repairs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-electric-50 text-electric-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Guaranteed Genuine Parts</h4>
                    <p className="text-xs text-navy-600 mt-0.5">
                      All parts used are OEM or certified OES quality, backed by warranty and digital invoice trails.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonials Card Showcase */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-6 bg-surface-50 rounded-2xl border border-surface-200">
                <div className="flex items-center gap-1 text-amber-500 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-navy-700 leading-relaxed italic mb-4">
                  &ldquo;BroCo Mod transformed my experience. Getting 3 competitive garage quotes in my neighborhood with a dedicated advisor who explained the difference between brake rotor resurfacing vs replacement saved me $280.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs">
                    DS
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy-900">Daniel S.</div>
                    <div className="text-[11px] text-navy-500">Audi A4 Owner • Dallas, TX</div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-surface-50 rounded-2xl border border-surface-200">
                <div className="flex items-center gap-1 text-amber-500 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-navy-700 leading-relaxed italic mb-4">
                  &ldquo;Being able to see photos of the damaged suspension arm before authorizing extra work gave me complete peace of mind. Truly the most professional platform I have used.&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-electric-600 text-white flex items-center justify-center font-bold text-xs">
                    ER
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy-900">Elena R.</div>
                    <div className="text-[11px] text-navy-500">Honda CR-V Owner • Austin, TX</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-20 bg-surface-50 border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-electric-600 uppercase tracking-wider">
              Got Questions?
            </span>
            <h2 className="text-3xl font-black text-navy-900 tracking-tight mt-2">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-5 bg-white rounded-2xl border border-surface-200 shadow-sm">
                <h4 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-electric-600 shrink-0" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-navy-600 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Bottom CTA Bar */}
      <section className="bg-navy-900 py-16 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready for Hassle-Free Automotive Care?
          </h2>
          <p className="text-sm text-surface-300 max-w-xl mx-auto leading-relaxed">
            Join thousands of car owners enjoying transparent pricing, accredited workshops, and live digital tracking.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link href="/customer/requests/new">
              <Button size="lg" variant="primary">
                Book a Service Now
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="border-navy-700 bg-navy-800 text-white hover:bg-navy-700">
                Register as Workshop Partner
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Global Footer */}
      <footer className="bg-navy-950 text-surface-400 py-12 text-xs border-t border-navy-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-navy-900">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-electric-600 flex items-center justify-center text-white">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="text-sm font-black text-white uppercase">BroCo Mod</span>
              </div>
              <p className="text-[11px] leading-relaxed text-surface-400">
                Automotive service platform providing verified workshops, transparent quoting, and live tracking.
              </p>
            </div>

            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Platform</div>
              <ul className="space-y-2">
                <li><Link href="/customer/dashboard" className="hover:text-white transition">Customer Portal</Link></li>
                <li><Link href="/garage/dashboard" className="hover:text-white transition">Garage Portal</Link></li>
                <li><Link href="/advisor/dashboard" className="hover:text-white transition">Advisor Portal</Link></li>
                <li><Link href="/admin/dashboard" className="hover:text-white transition">Super Admin</Link></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Services</div>
              <ul className="space-y-2">
                <li><a href="#services" className="hover:text-white transition">Periodic Maintenance</a></li>
                <li><a href="#services" className="hover:text-white transition">Diagnostics & Scans</a></li>
                <li><a href="#services" className="hover:text-white transition">Brake Overhaul</a></li>
                <li><a href="#services" className="hover:text-white transition">AC Servicing</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Support & Legal</div>
              <ul className="space-y-2">
                <li><a href="tel:18002762666" className="hover:text-white transition">1-800-BROCO-MOD</a></li>
                <li><a href="mailto:support@brocomod.com" className="hover:text-white transition">support@brocomod.com</a></li>
                <li><span className="text-surface-500">Privacy Policy</span></li>
                <li><span className="text-surface-500">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <span>© {new Date().getFullYear()} BroCo Mod Inc. All rights reserved.</span>
            <div className="flex items-center gap-2 text-surface-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Platform Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Track Vehicle Dialog */}
      <Modal
        isOpen={trackModalOpen}
        onClose={() => {
          setTrackModalOpen(false);
          setTrackResult(null);
        }}
        title="Track Service Request"
        description="Enter your Service Request Number (e.g. SR-2026-001) or Vehicle License Plate to view live status."
        size="sm"
      >
        <div className="space-y-4">
          <Input
            placeholder="e.g. SR-2026-001 or ABC-1234"
            value={trackQuery}
            onChange={(e) => setTrackQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />

          <Button
            className="w-full"
            onClick={() => {
              if (!trackQuery.trim()) return;
              setTrackResult(`Found request for ${trackQuery.trim().toUpperCase()}: Currently 'Work In Progress' at Apex Motorsport Autocare. Inspection completed.`);
            }}
          >
            Check Status
          </Button>

          {trackResult && (
            <div className="p-3.5 bg-electric-50 rounded-xl border border-electric-200 text-xs text-electric-900 leading-relaxed">
              <div className="font-bold text-electric-800 mb-1">Status Found:</div>
              {trackResult}
              <div className="mt-3">
                <Link href="/login?redirect=/customer/dashboard">
                  <Button variant="outline" size="sm" className="w-full">
                    Sign in to View Full Timeline
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
