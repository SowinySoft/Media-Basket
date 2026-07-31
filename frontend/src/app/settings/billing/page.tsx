"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, CreditCard, TrendingUp, Check } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["3 services", "3 members", "10 ML analyses/mo", "Basic sentiment", "Community support"],
    maxServices: 3,
    maxMembers: 3,
    maxMl: 10,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: ["10 services", "15 members", "100 ML analyses/mo", "Advanced sentiment + spam", "Priority support", "Custom alerting"],
    maxServices: 10,
    maxMembers: 15,
    maxMl: 100,
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "/mo",
    features: ["Unlimited services", "Unlimited members", "Unlimited ML analyses", "Full ML suite", "Dedicated support", "Custom alerting", "SSO / SAML", "Audit log export"],
    maxServices: 999,
    maxMembers: 999,
    maxMl: 999999,
  },
];

export default function BillingPage() {
  const router = useRouter();
  const { org } = useStore();
  const [plan, setPlan] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [planData, usageData] = await Promise.all([
        api.billing.getPlan(),
        api.billing.getUsage(),
      ]);
      setPlan(planData);
      setUsage(usageData);
    } catch {
      setPlan({ name: "free", max_services: 3, max_members: 3, max_ml_analyses: 10 });
      setUsage({ services_used: 0, members_used: 0, ml_analyses_used: 0 });
    }
    setLoading(false);
  };

  const currentPlanName = plan?.name || "free";
  const maxServices = plan?.max_services ?? 3;
  const maxMembers = plan?.max_members ?? 3;
  const maxMl = plan?.max_ml_analyses ?? 10;
  const servicesUsed = usage?.services_used ?? 0;
  const membersUsed = usage?.members_used ?? 0;
  const mlUsed = usage?.ml_analyses_used ?? 0;

  const pct = (used: number, limit: number) => limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CreditCard className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Billing</h1>
          </div>
          <ThemeToggle />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading billing info...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" />
                Current Plan
              </h2>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold capitalize">{currentPlanName}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-400">active</span>
              </div>
              <div className="text-sm text-gray-400 grid grid-cols-3 gap-4 mt-4">
                <div>
                  <span className="block text-white font-medium">{maxServices}</span>
                  max services
                </div>
                <div>
                  <span className="block text-white font-medium">{maxMembers}</span>
                  max members
                </div>
                <div>
                  <span className="block text-white font-medium">{maxMl}</span>
                  max ML analyses
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Usage
              </h2>
              <div className="space-y-4">
                {[
                  { label: "Services", used: servicesUsed, limit: maxServices },
                  { label: "Members", used: membersUsed, limit: maxMembers },
                  { label: "ML Analyses", used: mlUsed, limit: maxMl },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white">{item.used} / {item.limit === 999999 ? "unlimited" : item.limit}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct(item.used, item.limit)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Upgrade Plan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLANS.map((p) => {
                  const isCurrent = p.name.toLowerCase() === currentPlanName;
                  return (
                    <div
                      key={p.name}
                      className={`bg-gray-800 rounded-xl p-5 border transition-colors ${
                        isCurrent ? "border-blue-500 ring-1 ring-blue-500/30" : "border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      <h3 className="text-lg font-bold">{p.name}</h3>
                      <div className="mt-2 mb-4">
                        <span className="text-3xl font-bold">{p.price}</span>
                        <span className="text-gray-400 text-sm">{p.period}</span>
                      </div>
                      <ul className="space-y-2 mb-5">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                            <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        disabled={isCurrent}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          isCurrent
                            ? "bg-gray-700 text-gray-400 cursor-default"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        {isCurrent ? "Current Plan" : "Upgrade"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
