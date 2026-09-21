import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConnectivityBanner() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isChecking, setIsChecking] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCheckConnectivity = async () => {
    setIsChecking(true);
    try {
      // Test connectivity by pinging worker health or BFF
      const res = await fetch('/api/leads', { method: 'HEAD', cache: 'no-store' });
      if (res.ok || res.status === 405 || res.status === 200) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (showReconnected) {
    return (
      <div className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] px-4 py-1.5 text-xs flex items-center justify-between border-b border-[hsl(var(--success-border))] transition-opacity duration-200">
        <div className="flex items-center gap-2 w-full">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="font-medium">Connection Restored — Live telemetry active</span>
        </div>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] px-4 py-2 text-xs flex items-center justify-between border-b border-[hsl(var(--warning-border))] shadow-xs">
      <div className="flex items-center gap-2 w-full justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Network Disconnected — Running in offline mode. Telemetry polling suspended.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckConnectivity}
          disabled={isChecking}
          className="h-6 px-2 text-[11px] bg-[hsl(var(--warning-fg)/0.1)] hover:bg-[hsl(var(--warning-fg)/0.2)] border-[hsl(var(--warning-border))] text-[hsl(var(--warning-fg))]"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </div>
    </div>
  );
}
