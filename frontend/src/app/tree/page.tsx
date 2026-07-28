"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ServiceNode {
  id: string;
  name: string;
  type: string;
  status: string;
  children?: ServiceNode[];
}

export default function TreePage() {
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    // TODO: Fetch services from API
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-r p-4">
        <h2 className="text-lg font-bold mb-4">My Basket</h2>
        {services.length === 0 ? (
          <div className="text-gray-500 text-sm">
            <p>No services connected yet.</p>
            <button className="mt-2 text-blue-600 hover:underline">
              + Add Service
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((service) => (
              <div key={service.id} className="p-2 rounded hover:bg-gray-100 cursor-pointer">
                {service.name}
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold">Select a service</h1>
      </div>
    </main>
  );
}
