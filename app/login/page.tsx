'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

function LoginForm() {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter the access passcode');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid passcode. Access denied.');
        setLoading(false);
        return;
      }

      // Successful auth - redirect to dashboard
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas,#fafaf9)] flex flex-col justify-center items-center px-4 selection:bg-[#C1E1F7]">
      {/* Background Decorative Accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-40">
        <div className="w-[500px] h-[500px] bg-gradient-to-tr from-[#C1E1F7]/30 to-blue-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Top Header Card */}
        <div className="bg-white border border-[#E8E6E5] rounded-3xl p-8 shadow-sm">
          {/* Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F4F1] border border-[#E8E6E5] text-xs font-medium text-[#292524]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LeadPulse AI Private Gate</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F5F4F1] flex items-center justify-center text-[#78716C]">
              <ShieldCheck className="w-4 h-4 text-[#3BA6F1]" />
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-1 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#0C0A09]">
              Command Center
            </h1>
            <p className="text-sm text-[#78716C]">
              Enter your authorized team passcode to access the live dashboard and leads.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="passcode" 
                className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2"
              >
                Access Passcode
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A29E]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="passcode"
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter secret passcode..."
                  autoFocus
                  disabled={loading}
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-[#E8E6E5] bg-[#F5F4F1]/60 text-[#0C0A09] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#3BA6F1]/30 focus:border-[#3BA6F1] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#A8A29E] hover:text-[#0C0A09] transition-colors"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0C0A09] hover:bg-[#1C1917] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Unlock Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-[#E8E6E5] flex items-center justify-between text-xs text-[#A8A29E]">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#3BA6F1]" />
              Encrypted Session
            </span>
            <span>LeadPulse V2.0</span>
          </div>
        </div>

        {/* Security badge */}
        <p className="text-center text-xs text-[#A8A29E] mt-4">
          Restricted access. Only authorized operators with the valid key can view lead intelligence.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-canvas,#fafaf9)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#3BA6F1] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
