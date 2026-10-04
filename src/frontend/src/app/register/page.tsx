'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Wrench, ArrowRight, Lock, Mail, User, Phone, Building2, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [role, setRole] = useState<'CUSTOMER' | 'GARAGE_OWNER'>('CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [garageName, setGarageName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await register({
      email,
      password,
      fullName,
      phoneNumber,
      role,
      garageName: role === 'GARAGE_OWNER' ? garageName : undefined,
      address: role === 'GARAGE_OWNER' ? address : undefined,
    });

    if (!res.success) {
      setError(res.error || 'Registration failed. Please check your details.');
      return;
    }

    if (role === 'GARAGE_OWNER') {
      router.push('/garage/dashboard');
    } else {
      router.push('/customer/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-electric-500 flex items-center justify-center text-white shadow-lg shadow-electric-500/40">
            <Wrench className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="text-2xl font-black tracking-tight text-white uppercase">BroCo</span>
            <span className="text-2xl font-light tracking-widest text-electric-400 uppercase ml-1">Mod</span>
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">Create Platform Account</h2>
        <p className="mt-1 text-xs text-surface-300">
          Select account type and enter your details to register.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-surface-200">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Role Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-100 rounded-xl mb-5 border border-surface-200">
            <button
              type="button"
              onClick={() => setRole('CUSTOMER')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition ${
                role === 'CUSTOMER'
                  ? 'bg-electric-500 text-white shadow-sm'
                  : 'text-navy-700 hover:text-navy-900'
              }`}
            >
              Vehicle Owner (Customer)
            </button>
            <button
              type="button"
              onClick={() => setRole('GARAGE_OWNER')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition ${
                role === 'GARAGE_OWNER'
                  ? 'bg-electric-500 text-white shadow-sm'
                  : 'text-navy-700 hover:text-navy-900'
              }`}
            >
              Workshop / Garage Owner
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-600">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
                  required
                />
              </div>
            </div>

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
                  placeholder="alex@example.com"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-600">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
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
                  placeholder="Minimum 8 characters"
                  className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {role === 'GARAGE_OWNER' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                    Workshop / Business Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={garageName}
                      onChange={(e) => setGarageName(e.target.value)}
                      placeholder="Apex Motorsport Tuning"
                      className="block w-full pl-10 pr-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                    Workshop Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="400 Speed Blvd, Industrial Area"
                    className="block w-full px-3 py-2.5 border border-surface-300 rounded-xl text-sm placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-electric-500 text-navy-900"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-electric-500 hover:bg-electric-600 text-white font-semibold rounded-xl shadow-md shadow-electric-500/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{isLoading ? 'Creating Account...' : 'Complete Registration'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-navy-600">
            <span>Already have an account? </span>
            <Link href="/login" className="font-semibold text-electric-600 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
