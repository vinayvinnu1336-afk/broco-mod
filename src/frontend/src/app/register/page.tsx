'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Wrench, 
  ArrowRight, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Building2, 
  MapPin,
  ShieldCheck, 
  CheckCircle2, 
  Car,
  Clock,
  CreditCard,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [role, setRole] = useState<'CUSTOMER' | 'GARAGE_OWNER'>('CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [garageName, setGarageName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (role === 'GARAGE_OWNER' && (!garageName.trim() || !address.trim())) {
      setError('Please provide your workshop name and physical address.');
      return;
    }

    try {
      const res = await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        role,
        garageName: role === 'GARAGE_OWNER' ? garageName.trim() : undefined,
        address: role === 'GARAGE_OWNER' ? address.trim() : undefined,
      });

      if (!res.success) {
        // Sanitize technical messages to clean human-readable copy
        const rawErr = res.error || '';
        if (rawErr.toLowerCase().includes('already exists')) {
          setError(`An account with email ${email} already exists. Please sign in.`);
        } else if (rawErr.toLowerCase().includes('failed to fetch') || rawErr.toLowerCase().includes('network')) {
          setError('Unable to reach the server. Please check your connection and try again.');
        } else if (rawErr.length < 100 && !rawErr.includes('Exception')) {
          setError(rawErr);
        } else {
          setError('Unable to create your account right now. Please try again.');
        }
        return;
      }

      if (role === 'GARAGE_OWNER') {
        router.push('/garage/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: unknown) {
      console.error('Registration exception:', err);
      setError('Unable to create your account right now. Please try again.');
    }
  };

  const benefits = [
    {
      icon: <ShieldCheck className="w-5 h-5 text-electric-400" />,
      title: 'Verified Garages',
      desc: 'Accredited workshops screened for tools, OEM parts compliance, and certified mechanics.',
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-electric-400" />,
      title: 'Transparent Pricing',
      desc: 'Every quote is reviewed by certified automotive advisors with zero hidden markup.',
    },
    {
      icon: <Clock className="w-5 h-5 text-electric-400" />,
      title: 'Live Service Tracking',
      desc: 'Real-time milestones from inspection through vehicle ready and digital handover.',
    },
    {
      icon: <CreditCard className="w-5 h-5 text-electric-400" />,
      title: 'Secure Payments',
      desc: 'Escrow-protected payments released only upon customer satisfaction and vehicle delivery.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col justify-center font-sans">
      <div className="w-full flex-1 flex flex-col lg:flex-row min-h-screen">
        {/* LEFT SIDE: Brand Showcase & Automotive Benefits */}
        <div className="lg:w-1/2 bg-navy-900 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Glow Background */}
          <div className="absolute top-0 -left-10 w-96 h-96 bg-electric-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Logo Header */}
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-electric-600 flex items-center justify-center text-white shadow-lg shadow-electric-600/30 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center">
                  <span className="text-xl font-black tracking-tight text-white uppercase">BroCo</span>
                  <span className="text-xl font-light tracking-widest text-electric-400 uppercase ml-1">Mod</span>
                </div>
                <span className="text-[10px] text-surface-400 font-semibold tracking-wider uppercase block">
                  Automotive Service Platform
                </span>
              </div>
            </Link>
          </div>

          {/* Hero Branding Content */}
          <div className="my-12 relative z-10 space-y-8 max-w-lg">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-950/60 border border-electric-700/60 text-electric-300 text-xs font-semibold mb-4">
                <span>The Modern Automotive Care Experience</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Your Vehicle. <br />
                <span className="text-electric-400">Our Responsibility.</span>
              </h1>
              <p className="mt-3 text-sm text-surface-300 leading-relaxed">
                Connect with the highest-rated workshops in your area with independent advisor oversight and complete digital milestone tracking.
              </p>
            </div>

            {/* 4 Supporting Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
              {benefits.map((b) => (
                <div key={b.title} className="bg-navy-800/80 rounded-2xl p-4 border border-navy-700/80 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    {b.icon}
                    <span>{b.title}</span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed pl-7">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="relative z-10 pt-6 border-t border-navy-800 text-xs text-surface-400 flex items-center justify-between">
            <span>Enterprise Data Encryption & Privacy</span>
            <span>Accredited Workshop Network</span>
          </div>
        </div>

        {/* RIGHT SIDE: Clean White Registration Form */}
        <div className="lg:w-1/2 bg-white p-6 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-2xl font-black text-navy-900 tracking-tight">Create Your Account</h2>
              <p className="mt-1 text-xs text-navy-500">
                Join BroCo Mod as a vehicle owner or workshop service partner.
              </p>
            </div>

            {/* Account Role Selector */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-100 rounded-2xl border border-surface-200">
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2.5 px-3 text-xs font-bold rounded-xl transition ${
                  role === 'CUSTOMER'
                    ? 'bg-white text-navy-900 shadow-sm border border-surface-200'
                    : 'text-navy-600 hover:text-navy-900'
                }`}
              >
                Vehicle Owner
              </button>
              <button
                type="button"
                onClick={() => setRole('GARAGE_OWNER')}
                className={`py-2.5 px-3 text-xs font-bold rounded-xl transition ${
                  role === 'GARAGE_OWNER'
                    ? 'bg-white text-navy-900 shadow-sm border border-surface-200'
                    : 'text-navy-600 hover:text-navy-900'
                }`}
              >
                Workshop Partner
              </button>
            </div>

            {error && (
              <Alert type="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Full Legal Name"
                placeholder="e.g. Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 (555) 019-2834"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
                required
              />

              <div className="w-full">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-navy-400 hover:text-navy-700 pointer-events-auto"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />
              </div>

              {role === 'GARAGE_OWNER' && (
                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-4">
                  <div className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                    Workshop Profile Details
                  </div>
                  <Input
                    label="Workshop / Business Name"
                    placeholder="Apex Motorsport Tuning & Repair"
                    value={garageName}
                    onChange={(e) => setGarageName(e.target.value)}
                    leftIcon={<Building2 className="w-4 h-4" />}
                    required
                  />

                  <Input
                    label="Workshop Physical Address"
                    placeholder="400 Speed Blvd, Industrial Area"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4" />}
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-4"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Creating Account...' : 'Complete Registration'}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-navy-600">
              <span>Already have an account? </span>
              <Link href="/login" className="font-bold text-electric-600 hover:text-electric-700 hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
