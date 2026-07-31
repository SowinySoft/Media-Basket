"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Database, Download, Upload, Clock, CheckCircle } from "lucide-react";

export default function BackupPage() {
  const router = useRouter();
  const [backingUp, setBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [lastBackup] = useState({ date: "2026-07-30 02:00 UTC", size: "12.4 MB", status: "success" });

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
  }, []);

  const handleBackup = () => {
    setBackingUp(true);
    setBackupMessage("");
    setTimeout(() => {
      setBackingUp(false);
      setBackupMessage("Backup initiated. You will be notified when it completes.");
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/settings")} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Database className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Backup & Restore</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Last Backup
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-gray-400 mb-1">Date</span>
                <span className="text-white font-medium">{lastBackup.date}</span>
              </div>
              <div>
                <span className="block text-gray-400 mb-1">Size</span>
                <span className="text-white font-medium">{lastBackup.size}</span>
              </div>
              <div>
                <span className="block text-gray-400 mb-1">Status</span>
                <span className="inline-flex items-center gap-1 text-green-400 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {lastBackup.status}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              Manual Backup
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Trigger a manual backup of all organization data including services, content, members, and settings.
            </p>
            <button
              onClick={handleBackup}
              disabled={backingUp}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {backingUp ? "Starting backup..." : "Start Backup"}
            </button>
            {backupMessage && (
              <div className="mt-3 p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-400 text-sm">
                {backupMessage}
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              Restore from Backup
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Upload a backup file to restore your organization data. This will overwrite current data.
            </p>
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-gray-500 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Drag and drop a backup file here, or click to browse</p>
              <p className="text-gray-500 text-xs mt-1">Supports .json backup files</p>
              <input type="file" accept=".json" className="hidden" readOnly />
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Backup Schedule
            </h2>
            <p className="text-sm text-gray-400">
              Backups run daily at <span className="text-white font-medium">2:00 AM UTC</span>. The last 7 daily backups are retained automatically.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
