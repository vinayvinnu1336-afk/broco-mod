'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Wrench, 
  ArrowRight, 
  Lock, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';
  const expired = searchParams.get('expired') === 'true';

  const { login, quickLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      const res = await login(email.trim(), password);
      if (!res.success) {
        const rawErr = res.error || '';
        if (rawErr.toLowerCase().includes('invalid') || rawErr.toLowerCase().includes('credentials') || rawErr.toLowerCase().includes('password')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (rawErr.toLowerCase().includes('network') || rawErr.toLowerCase().includes('failed to fetch')) {
          setError('Unable to reach the server. Please check your internet connection.');
        } else if (rawErr.length < 100 && !rawErr.includes('Exception')) {
          setError(rawErr);
        } else {
          setError('We could not sign you in right now. Please try again.');
        }
        return;
      }

      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError('We could not sign you in right now. Please try again.');
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
                Log in to access your active service jobs, compare workshop quotations, and track repair milestones in real time.
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

        {/* RIGHT SIDE: Clean White Login Form */}
        <div className="lg:w-1/2 bg-white p-6 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
          <div className="w-full max-w-md space-y-6">
            <div>
              <h2 className="text-2xl font-black text-navy-900 tracking-tight">Sign In to BroCo Mod</h2>
              <p className="mt-1 text-xs text-navy-500">
                Enter your registered credentials to access your portal.
              </p>
            </div>

            {expired && (
              <Alert type="warning">
                Your session has expired. Please sign in to resume.
              </Alert>
            )}

            {error && (
              <Alert type="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <div className="w-full">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
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

              <div className="flex items-center justify-between text-xs pt-1">
                <Checkbox
                  label="Remember me on this device"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => alert('Please contact support@brocomod.com to reset your password.')}
                  className="font-semibold text-electric-600 hover:text-electric-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-4"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? 'Verifying...' : 'Sign In to Portal'}
              </Button>
            </form>

            {/* Quick-Switch Demo Accounts for testing */}
            <div className="pt-6 border-t border-surface-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Instant Demo Profile Switcher</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-electric-50 text-electric-700">
                  Quick Access
                </span>
              </div>
              <p className="text-[11px] text-navy-500 mb-3">
                Select a verified profile to test isolated role views:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickLogin('customer')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-electric-50/40 rounded-xl transition group"
                >
                  <div className="text-xs font-bold text-navy-900 group-hover:text-electric-700">Customer</div>
                  <div className="text-[10px] text-navy-500 font-mono">customer@brocomod.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('garage')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-electric-50/40 rounded-xl transition group"
                >
                  <div className="text-xs font-bold text-navy-900 group-hover:text-electric-700">Garage Partner</div>
                  <div className="text-[10px] text-navy-500 font-mono">garage.owner@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('advisor')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-electric-50/40 rounded-xl transition group"
                >
                  <div className="text-xs font-bold text-navy-900 group-hover:text-electric-700">Service Advisor</div>
                  <div className="text-[10px] text-navy-500 font-mono">advisor@brocomod.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('admin')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-electric-50/40 rounded-xl transition group"
                >
                  <div className="text-xs font-bold text-navy-900 group-hover:text-electric-700">Super Admin</div>
                  <div className="text-[10px] text-navy-500 font-mono">admin@brocomod.com</div>
                </button>
              </div>
            </div>

            <div className="pt-2 text-center text-xs text-navy-600">
              <span>Need a new account? </span>
              <Link href="/register" className="font-bold text-electric-600 hover:text-electric-700 hover:underline">
                Register here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-50 flex items-center justify-center text-navy-600 text-xs">
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
