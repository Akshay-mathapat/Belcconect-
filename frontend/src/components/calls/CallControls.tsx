"use client";

import { useState } from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, ShieldAlert, X } from "lucide-react";

interface CallControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  callId?: string;
  onReportCall?: (reason: string) => void;
}

export default function CallControls({
  isMuted,
  onToggleMute,
  onEndCall,
  callId,
  onReportCall
}: CallControlsProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim() || !callId) return;

    setIsSubmittingReport(true);
    try {
      if (onReportCall) {
        onReportCall(reportReason.trim());
      } else {
        await fetch(`/api/calls/${callId}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reportReason.trim() })
        });
      }
      setReportSubmitted(true);
      setTimeout(() => {
        setReportSubmitted(false);
        setShowReportModal(false);
        setReportReason("");
      }, 2000);
    } catch (e) {
      console.error("Failed to report call:", e);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      {/* Mute Button */}
      <button
        type="button"
        onClick={onToggleMute}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
          isMuted
            ? "bg-rose-500 text-white hover:bg-rose-600 ring-4 ring-rose-500/20"
            : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
        }`}
        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
      >
        {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {/* End Call Button */}
      <button
        type="button"
        onClick={onEndCall}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl ring-4 ring-rose-600/30 scale-105 active:scale-95"
        title="End Voice Call"
      >
        <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>

      {/* Report Call Safety Button */}
      {callId && (
        <button
          type="button"
          onClick={() => setShowReportModal(true)}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 text-amber-400 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-lg"
          title="Report Call Abuse or Safety Issue"
        >
          <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Safety Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Report Voice Call
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                Call reported to BelConnect trust & safety team.
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Calls are monitored for trust and security. Let us know if you experienced inappropriate behavior or spam.
                </p>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Reason for Report
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe issue (e.g. offensive language, inappropriate request, spam)..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md"
                  >
                    {isSubmittingReport ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
