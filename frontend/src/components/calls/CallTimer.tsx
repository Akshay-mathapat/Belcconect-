"use client";

import { useState, useEffect, useRef } from "react";

interface CallTimerProps {
  startTime?: number | string | Date;
}

export default function CallTimer({ startTime }: CallTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const connectTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Reset timer to start strictly from 00:00 on call connection mount
    connectTimeRef.current = Date.now();
    setElapsedSeconds(0);

    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - connectTimeRef.current) / 1000));
      setElapsedSeconds(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  const formattedMins = String(mins).padStart(2, "0");
  const formattedSecs = String(secs).padStart(2, "0");

  return (
    <div className="font-mono text-xs sm:text-sm font-extrabold tracking-wider text-emerald-400 bg-emerald-950/60 px-3.5 py-1 rounded-full border border-emerald-500/30 shadow-inner">
      {formattedMins}:{formattedSecs}
    </div>
  );
}
