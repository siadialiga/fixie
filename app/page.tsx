"use client";

import { useState } from "react";
import LineWaves from './components/LineWaves';
import Footer from './components/Footer';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState({ loading: false, message: "", error: false, prUrl: "" });
  const [, setJobId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: idle, 1: queued, 2: forking, 3: scanning, 4: completed/error
  const [showReRun, setShowReRun] = useState<boolean>(false);
  const [lastSubmittedUrl, setLastSubmittedUrl] = useState<string>("");

  const pollStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();

      if (data.status === "COMPLETED") {
        setStatus({ loading: false, message: data.message, error: false, prUrl: data.prUrl });
        setJobId(null);
        setCurrentStep(4);
      } else if (data.status === "ERROR") {
        setStatus({ loading: false, message: data.message, error: true, prUrl: "" });
        setJobId(null);
        setCurrentStep(4);
      } else if (data.status === "PROCESSING") {
        setStatus({ loading: true, message: "Processing your repository... This may take a few minutes.", error: false, prUrl: "" });
        setCurrentStep((prev) => {
          if (prev < 2) return 2;
          if (prev === 2) return 3;
          return prev;
        });
        setTimeout(() => pollStatus(id), 3000);
      } else {
        setStatus({ loading: true, message: "Waiting in queue...", error: false, prUrl: "" });
        setCurrentStep(1);
        setTimeout(() => pollStatus(id), 3000);
      }
    } catch {
      setTimeout(() => pollStatus(id), 3000);
    }
  };

  const submitJob = async (url: string, force: boolean = false) => {
    setStatus({ loading: true, message: "Adding to queue...", error: false, prUrl: "" });
    setJobId(null);
    setShowReRun(false);
    setCurrentStep(1);

    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url, force }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (data.alreadyExists) {
        setStatus({
          loading: false,
          message: data.message,
          error: false,
          prUrl: data.prUrl || ""
        });
        setJobId(data.jobId);
        setLastSubmittedUrl(url);
        setShowReRun(true);
        if (data.status === "COMPLETED") {
          setCurrentStep(4);
        } else if (data.status === "ERROR") {
          setCurrentStep(4);
          setStatus((prev) => ({ ...prev, error: true }));
        } else if (data.status === "PROCESSING") {
          setCurrentStep(3);
          pollStatus(data.jobId);
        } else {
          setCurrentStep(1);
          pollStatus(data.jobId);
        }
      } else if (data.jobId) {
        setJobId(data.jobId);
        pollStatus(data.jobId);
      } else {
        setStatus({ loading: false, message: data.message, error: false, prUrl: "" });
        setCurrentStep(0);
      }
      setRepoUrl("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred";
      setStatus({ loading: false, message, error: true, prUrl: "" });
      setCurrentStep(4);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitJob(repoUrl, false);
  };

  return (
    <main
      className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 pb-24 overflow-hidden selection:bg-neutral-800 selection:text-white"
    >
      {/* background linewaves */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(0.30em)' }}>
        <LineWaves
          speed={0.1}
          innerLineCount={32}
          outerLineCount={36}
          warpIntensity={1}
          rotation={-45}
          edgeFadeWidth={0}
          colorCycleSpeed={1}
          brightness={0.2}
          color1="#ffffff"
          color2="#ffffff"
          color3="#ffffff"
          enableMouseInteraction
          mouseInfluence={2}
        />
      </div>

      {/* radial ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neutral-900/10 rounded-full blur-[120px] pointer-events-none z-0"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center gap-12">

        {/* header */}
        <div className="text-center flex flex-col items-center gap-4">
          <h1 className="text-5xl md:text-8xl font-bold tracking-tight bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent py-1">
            Fixie
          </h1>
          <p className="text-neutral-400 text-base max-w-lg leading-relaxed">
            An autonomous link resolver that scans public GitHub repositories, restores broken URLs using Wayback Machine archives, and opens pull requests.
          </p>
        </div>

        {/* main form card */}
        <div className="w-full bg-neutral-900/40 backdrop-blur-md border border-neutral-900 rounded-xl p-8 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Repository URL</label>
                <span className="text-[10px] text-neutral-500">Public repositories only</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/repository"
                  className="flex-1 bg-black/60 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-neutral-700 transition duration-200 placeholder-neutral-600"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={status.loading}
                />
                <button
                  type="submit"
                  disabled={status.loading || !repoUrl}
                  className="bg-white cursor-pointer hover:bg-neutral-200 text-black text-sm font-semibold rounded-lg px-5 py-3 transition duration-200 disabled:opacity-30 disabled:hover:bg-white disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {status.loading ? "Processing..." : "Fix Links"}
                </button>
              </div>
            </div>
          </form>

          {/* status & stepper area */}
          {currentStep > 0 && (
            <div className="mt-8 pt-6 border-t border-neutral-900 space-y-6">

              {/* status indicator */}
              <div className="flex flex-col gap-4 bg-black/40 border border-neutral-900 p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 w-full">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Current Status</span>
                    <p className="text-sm font-medium text-neutral-200">{status.message}</p>
                  </div>
                  {status.prUrl && (
                    <a
                      href={status.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-800 border border-neutral-800 rounded-md px-3 py-1.5 transition duration-150"
                    >
                      View PR ↗
                    </a>
                  )}
                </div>
                {showReRun && (
                  <div className="pt-3 border-t border-neutral-900/60 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Want to run it again? This overwrites the existing job.</span>
                    <button
                      onClick={() => submitJob(lastSubmittedUrl, true)}
                      className="font-bold text-white hover:underline transition duration-150 cursor-pointer"
                    >
                      Re-run Fixie
                    </button>
                  </div>
                )}
              </div>

              {/* stepper */}
              <div className="relative flex justify-between w-full pt-2">
                {/* Background Connecting Line */}
                <div className="absolute top-5 left-0 right-0 h-[2px] bg-neutral-900 z-0" />

                {/* Foreground Progress Line */}
                <div
                  className="absolute top-5 left-0 h-[2px] bg-white transition-all duration-500 z-0"
                  style={{
                    width: `${currentStep === 0 ? 0 : ((currentStep - 1) / 3) * 100}%`
                  }}
                />

                {/* Steps */}
                {[
                  { label: "Queued" },
                  { label: "Forking" },
                  { label: "Scanning" },
                  { label: "Completed" }
                ].map((item, idx) => {
                  const stepNum = idx + 1;
                  const isCompleted = currentStep > stepNum;
                  const isActive = currentStep === stepNum;
                  const isError = status.error && idx === 3 && currentStep === 4;

                  return (
                    <div key={idx} className="relative z-10 flex flex-col items-center gap-2 w-16">
                      {/* Step Node */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${isError
                            ? "bg-red-950 border-red-500 text-red-500"
                            : isCompleted
                              ? "bg-white border-white text-black"
                              : isActive
                                ? "bg-black border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                : "bg-black border-neutral-800 text-neutral-500"
                          }`}
                      >
                        {isCompleted ? "✓" : stepNum}
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wider text-center ${isError
                          ? "text-red-500"
                          : isActive || isCompleted
                            ? "text-white"
                            : "text-neutral-500"
                        }`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>

        {/* features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-4">
          <div className="bg-neutral-950/40 border border-neutral-900/60 rounded-lg p-5 space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Archive.org Integration</span>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Scans markdown files to identify broken or dead hyperlinks and automatically matches them with working Archive.org snapshots.
            </p>
          </div>
          <div className="bg-neutral-950/40 border border-neutral-900/60 rounded-lg p-5 space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Automated Pull Request</span>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Handles the complete flow: forks the repository, creates a dedicated branch, commits the link updates, and creates a clean pull request.
            </p>
          </div>
          <div className="bg-neutral-950/40 border border-neutral-900/60 rounded-lg p-5 space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Queue-Based Safety</span>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Processes submissions in a safe, sequential queue with built-in request cooldowns to ensure full rate limit safety for the bot.
            </p>
          </div>
        </div>

      </div>
      <Footer />
    </main>
  );
}