"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";

export function DownloadData() {
  return (
    <a href="/api/profile/export" download
       className="ink-btn block bg-white px-4 py-3 text-center text-[0.95rem]">
      Download my data
    </a>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true); setError(null);
    const res = await fetch("/api/profile/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "Could not delete."); return; }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <Button tone="danger" full onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-danger bg-danger-soft p-4">
      <p className="font-bold text-danger">Delete your account</p>
      <p className="mt-1 text-sm">
        This removes your profile, CV, saved jobs, applications, rejection
        entries, reviews and uploaded files. It cannot be undone.
      </p>
      <p className="mt-2 text-sm">Type <strong>DELETE</strong> to confirm.</p>
      <input className="ink-input mt-2" value={confirm}
        onChange={(e) => setConfirm(e.target.value)} />
      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-3">
        <Button className="flex-1" onClick={() => { setOpen(false); setConfirm(""); }}>
          Cancel
        </Button>
        <Button tone="danger" className="flex-1" disabled={busy || confirm !== "DELETE"}
          onClick={doDelete}>
          {busy ? "Deleting…" : "Delete for good"}
        </Button>
      </div>
    </div>
  );
}

export function SignOut() {
  return (
    <form action="/api/auth/signout" method="post">
      <button className="ink-btn w-full bg-white px-4 py-3 text-[0.95rem]">Log out</button>
    </form>
  );
}

export { Notice };
