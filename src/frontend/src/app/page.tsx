"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, Activity, Database, Server, Radio, ArrowRight } from "lucide-react";

interface HealthStatus {
  status: string;
  totalDuration: string;
  entries?: Record<string, { status: string; description?: string; duration?: string }>;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Health check returned status ${res.status}`);
        }
        const data = await res.json();
        setHealth(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to fetch health check");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto flex flex-col justify-between">
      <div>
        <header className="border-b border-slate-800 pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">
                Foundation Architecture Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              BroCo Mod Platform
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Production-Grade Modular Monolith Foundation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-mono rounded-md border border-slate-700">
              PostgreSQL + PostGIS
            </span>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-mono rounded-md border border-slate-700">
              Redis Cache
            </span>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-mono rounded-md border border-slate-700">
              ASP.NET Core 8
            </span>
          </div>
        </header>

        {/* System Health Section */}
        <section className="mb-10 p-6 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-indigo-400" />
              Infrastructure Status
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                health?.status === "Healthy"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : loading
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {loading ? "Checking Connectivity..." : health?.status || "API Ready"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-800/80 flex items-start gap-3">
              <Database className="w-5 h-5 text-sky-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-200">PostgreSQL + PostGIS</p>
                <p className="text-xs text-slate-400 mt-1">Spatial Engine & Geo-Radius 10KM</p>
                <p className="text-xs text-emerald-400 mt-2 font-mono">
                  {health?.entries?.["postgres"]?.status ?? "Configured"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-800/80 flex items-start gap-3">
              <Radio className="w-5 h-5 text-rose-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-200">Redis Infrastructure</p>
                <p className="text-xs text-slate-400 mt-1">Distributed Cache & Event Bus</p>
                <p className="text-xs text-emerald-400 mt-2 font-mono">
                  {health?.entries?.["redis"]?.status ?? "Configured"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-800/80 flex items-start gap-3">
              <Server className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-200">Stateless API Monolith</p>
                <p className="text-xs text-slate-400 mt-1">Clean Architecture Core</p>
                <p className="text-xs text-emerald-400 mt-2 font-mono">
                  {health ? "Online" : error ? "Awaiting Startup" : "Ready"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Four Target Portals Overview */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            Target Portals Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="text-xs uppercase font-semibold text-emerald-400 mb-2">Portal 1</div>
              <h3 className="text-base font-semibold text-white mb-2">Customer Portal</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Request submission, geo-location picking, view approved customer-facing quotations, and accept/reject services.
              </p>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <span>Data Isolation</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="p-5 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="text-xs uppercase font-semibold text-sky-400 mb-2">Portal 2</div>
              <h3 className="text-base font-semibold text-white mb-2">Garage Portal</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Service request notifications within 10 KM radius, job estimation, internal cost breakdown, and quotation submission.
              </p>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <span>Internal Pricing</span>
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              </div>
            </div>

            <div className="p-5 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="text-xs uppercase font-semibold text-amber-400 mb-2">Portal 3</div>
              <h3 className="text-base font-semibold text-white mb-2">Advisor Portal</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Review garage quotations, margin calculation, quotation assignment, and dispatching customer-facing proposals.
              </p>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <span>Margin & Review</span>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>

            <div className="p-5 bg-slate-900/40 rounded-xl border border-slate-800 hover:border-slate-700 transition">
              <div className="text-xs uppercase font-semibold text-purple-400 mb-2">Portal 4</div>
              <h3 className="text-base font-semibold text-white mb-2">Super Admin Portal</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Platform oversight, garage onboarding, radius tuning (default 10 KM), system configuration, and audit logs.
              </p>
              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <span>Global Governance</span>
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Security & Isolation Note */}
        <section className="p-5 bg-indigo-950/30 rounded-xl border border-indigo-900/50 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-indigo-300 block mb-1">
              Pricing Security & Data Isolation Enforced:
            </span>
            Garage internal pricing is strictly segregated at the domain and application layer using
            role-specific DTO projections and authorization policies. Garage cost components never leave
            the internal boundary and are inaccessible to customer-facing endpoints.
          </div>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3">
        <span>BroCo Mod &copy; {new Date().getFullYear()} — Production Architecture Foundation</span>
        <div className="flex gap-4">
          <span className="hover:text-slate-400">Docs: /docs/architecture</span>
          <span className="hover:text-slate-400">Health: /health</span>
        </div>
      </footer>
    </main>
  );
}
