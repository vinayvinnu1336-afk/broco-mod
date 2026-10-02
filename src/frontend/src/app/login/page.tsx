'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Wrench, Shield, ArrowRight, Lock, Mail, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '';
  const expired = searchParams.get('expired') === 'true';

  const { login, quickLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    const res = await login(email, password);
    if (!res.success) {
      setError(res.error || 'Authentication failed. Please verify credentials.');
      return;
    }

    if (redirect) {
      router.push(redirect);
    } else {
      // Direct user based on role or default to customer
      router.push('/customer/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="inline-flex items-center gap-2.5 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-electric-500 flex items-center justify-center text-white shadow-lg shadow-electric-500/40">
            <Wrench className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="text-2xl font-black tracking-tight text-white uppercase">BroCo</span>
            <span className="text-2xl font-light tracking-widest text-electric-400 uppercase ml-1">Mod</span>
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">Platform Authentication Portal</h2>
        <p className="mt-1 text-xs text-surface-300">
          Enter credentials or select an authenticated demo profile below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-surface-200">
          {expired && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Your session has expired. Please authenticate to resume.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-600">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@brocomod.com"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 focus:border-transparent text-navy-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-600">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 focus:border-transparent text-navy-900"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-electric-500 hover:bg-electric-600 text-white font-semibold rounded-xl shadow-md shadow-electric-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick-Switch Demo Accounts (development & demo environments only) */}
          {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCOUNTS === 'true') && (
            <div className="mt-6 pt-6 border-t border-surface-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
                <UserCheck className="w-4 h-4 text-electric-500" />
                <span>Instant Demo Account Switcher</span>
                <span className="ml-auto text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">Dev Only</span>
              </div>
              <p className="text-[11px] text-navy-600 mb-3">
                One-click authentications to test live role segregation:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => quickLogin('customer')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-blue-50/50 rounded-xl transition"
                >
                  <div className="text-xs font-bold text-navy-900">Customer</div>
                  <div className="text-[10px] text-navy-600 font-mono">customer@brocomod.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('garage')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-blue-50/50 rounded-xl transition"
                >
                  <div className="text-xs font-bold text-navy-900">Garage Owner</div>
                  <div className="text-[10px] text-navy-600 font-mono">garage.owner@...</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('advisor')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-blue-50/50 rounded-xl transition"
                >
                  <div className="text-xs font-bold text-navy-900">Advisor</div>
                  <div className="text-[10px] text-navy-600 font-mono">advisor@brocomod.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => quickLogin('admin')}
                  className="p-2.5 text-left border border-surface-200 hover:border-electric-400 bg-surface-50 hover:bg-blue-50/50 rounded-xl transition"
                >
                  <div className="text-xs font-bold text-navy-900">Super Admin</div>
                  <div className="text-[10px] text-navy-600 font-mono">admin@brocomod.com</div>
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 text-center text-xs text-navy-600">
            <span>Need a new account? </span>
            <Link href="/register" className="font-semibold text-electric-600 hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-white text-xs">
        Loading authentication terminal...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
