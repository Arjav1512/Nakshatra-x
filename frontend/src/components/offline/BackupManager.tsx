'use client';

import { useState, } from 'react';
import { exportOfflineData } from '@/lib/offline/db';

interface BackupManagerProps {
  role: 'judge' | 'user';
}

export default function BackupManager({ role }: BackupManagerProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await exportOfflineData();
      if (!data) throw new Error("No data found to export.");
      
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moil_emergency_backup_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export failed", err);
      setError(err.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  if (role !== 'judge') {
    return (
      <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-md text-white text-sm">
        <h3 className="font-bold mb-2">Emergency Sync Status</h3>
        <p className="text-gray-400">Your offline data is automatically queued and will sync when a connection is restored.</p>
        {/* Normal users get a simple status, not manual export controls to prevent data tampering */}
      </div>
    );
  }

  // Judge/Admin view gets full export capabilities for evaluation
  return (
    <div className="p-4 bg-blue-900 border border-blue-700 rounded-lg shadow-md text-white">
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
        Judge Panel: Emergency Data Tools
      </h3>
      <p className="text-blue-200 text-sm mb-4">
        As a judge, you have access to manually export the encrypted offline IndexedDB state for evaluation purposes. This simulates a physical data extraction in a zero-connectivity zone.
      </p>
      
      <button type="button" 
        onClick={handleExport}
        disabled={exporting}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold transition-colors disabled:opacity-50"
      >
        {exporting ? 'Exporting...' : 'Export Offline Data Backup (.json)'}
      </button>
      
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
