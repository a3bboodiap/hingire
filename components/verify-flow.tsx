"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Notice } from "@/components/ui";

type Step = "consent" | "route" | "capture" | "result";

export function VerifyFlow({ next, attemptsUsed, attemptsMax }: {
  next: string; attemptsUsed: number; attemptsMax: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("consent");
  const [biometric, setBiometric] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    passed: boolean; detail: string; engine?: string; manualReview?: boolean;
    attemptsUsed?: number; attemptsMax?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function startCamera() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
    } catch {
      setError("We could not open the camera. Check the permission and try again.");
    }
  }

  async function consent(route: "document" | "electronic_id") {
    setBusy(true); setError(null);
    const res = await fetch("/api/kyc/consent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ biometric: route === "document" ? biometric : false, route }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    if (route === "document") { setStep("capture"); startCamera(); }
    else electronicId();
  }

  async function electronicId() {
    setBusy(true);
    const res = await fetch("/api/kyc/electronic-id", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error); return; }
    setResult({ passed: true, detail: "Verified with electronic ID." });
    setStep("result");
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true); setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) { setBusy(false); setError("Could not take the photo."); return; }

    const fd = new FormData();
    fd.append("photo", new File([blob], "capture.jpg", { type: "image/jpeg" }));
    const res = await fetch("/api/kyc/document", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(false);

    if (!res.ok) { setError(j.error); return; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setResult(j.data);
    setStep("result");
    router.refresh();
  }

  /* ---------------- consent ---------------- */
  if (step === "consent") {
    return (
      <div className="space-y-4">
        <Notice tone="gold" title="Prototype check">
          Prototype check: a certified KYC provider replaces this at launch.
        </Notice>
        <div className="ink-card-flat p-4 text-sm">
          <h2 className="font-bold">Before we start</h2>
          <p className="mt-2 text-ink-soft">
            To publish a review we need to know you are a real person over 18.
          </p>
          <p className="mt-2 text-ink-soft">
            One way uses a photo of your ID and a short face check.
            <strong className="text-ink"> A face scan is biometric data.</strong> That means
            it is specially protected, and we only use it to confirm the document
            belongs to you.
          </p>
          <p className="mt-2 text-ink-soft">
            We never keep your document or your face data. We store only the
            result: pass or fail, the date, a reference, an over-18 flag and a
            name-match flag.
          </p>
          <p className="mt-2 text-ink-soft">
            You do not have to use the face check — there is a non-biometric
            route using a recognised electronic ID.
          </p>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-5" checked={biometric}
              onChange={(e) => setBiometric(e.target.checked)} />
            <span>
              I explicitly consent to the face check and to my biometric data
              being processed for identity verification.
            </span>
          </label>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button tone="money" full onClick={() => setStep("route")}>Continue</Button>
        <Link href={next} className="block text-center text-sm underline text-ink-soft">
          Not now
        </Link>
      </div>
    );
  }

  /* ---------------- route choice ---------------- */
  if (step === "route") {
    return (
      <div className="space-y-4">
        <h2 className="font-bold">Choose how to verify</h2>
        <button onClick={() => consent("document")} disabled={busy || !biometric}
          className="ink-card-flat w-full p-4 text-left disabled:opacity-50">
          <p className="font-bold">Scan my ID + face check</p>
          <p className="mt-1 text-sm text-ink-soft">
            Live camera only. Passport, national ID or residence card.
          </p>
          {!biometric ? (
            <p className="mt-1 text-xs text-danger">
              Needs your consent to the face check — go back and tick the box.
            </p>
          ) : null}
        </button>
        <button onClick={() => consent("electronic_id")} disabled={busy}
          className="ink-card-flat w-full p-4 text-left">
          <p className="font-bold">Use an electronic ID</p>
          <p className="mt-1 text-sm text-ink-soft">
            No biometrics. FNMT digital certificate or electronic DNI.
          </p>
        </button>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <button onClick={() => setStep("consent")} className="text-sm underline text-ink-soft">
          Back
        </button>
      </div>
    );
  }

  /* ---------------- capture ---------------- */
  if (step === "capture") {
    return (
      <div className="space-y-4">
        <Notice tone="gold">
          Prototype check: a certified KYC provider replaces this at launch.
        </Notice>
        <p className="text-sm text-ink-soft">
          Hold your ID inside the frame. All four corners visible, no glare.
          Live camera only — you cannot upload from your gallery.
        </p>
        <div className="overflow-hidden rounded-2xl border-2 border-ink bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button tone="money" full onClick={capture} disabled={busy}>
          {busy ? "Checking…" : "Take the photo"}
        </Button>
        <p className="text-center text-xs text-ink-faint">
          {attemptsMax - attemptsUsed} of {attemptsMax} tries left today.
        </p>
      </div>
    );
  }

  /* ---------------- result ---------------- */
  return (
    <div className="space-y-4">
      {result?.passed ? (
        <>
          <Notice tone="money" title="Verified">
            {result.detail} You now have a Verified badge and can publish reviews.
          </Notice>
          <Link href={next}><Button tone="money" full>Continue</Button></Link>
        </>
      ) : (
        <>
          <Notice tone="danger" title={result?.manualReview ? "Sent for manual review" : "That did not pass"}>
            {result?.detail}
          </Notice>
          {result?.engine === "offline" ? (
            <Notice tone="gold" title="Image check is switched off here">
              This deployment has no AI key, so the photo check cannot run at
              all. Nothing is wrong with your document.
            </Notice>
          ) : null}
          {!result?.manualReview ? (
            <Button tone="money" full onClick={() => { setResult(null); setStep("capture"); startCamera(); }}>
              Try again
            </Button>
          ) : null}
          <Link href={next} className="block text-center text-sm underline text-ink-soft">
            Go back
          </Link>
        </>
      )}
    </div>
  );
}
