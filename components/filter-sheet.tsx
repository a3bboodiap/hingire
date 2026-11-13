"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field } from "@/components/ui";

export function FilterSheet() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [minPay, setMinPay] = useState(params.get("minPay") ?? "");
  const [contract, setContract] = useState<string[]>(
    params.get("contract")?.split(",").filter(Boolean) ?? [],
  );
  const [remote, setRemote] = useState<string[]>(
    params.get("remote")?.split(",").filter(Boolean) ?? [],
  );

  const activeCount =
    (location ? 1 : 0) + (minPay ? 1 : 0) + (contract.length ? 1 : 0) + (remote.length ? 1 : 0);

  function apply() {
    const q = new URLSearchParams();
    if (location) q.set("location", location);
    if (minPay) q.set("minPay", minPay);
    if (contract.length) q.set("contract", contract.join(","));
    if (remote.length) q.set("remote", remote.join(","));
    router.push(`/job-offers${q.toString() ? "?" + q : ""}`);
    setOpen(false);
  }

  function clear() {
    setLocation(""); setMinPay(""); setContract([]); setRemote([]);
    router.push("/job-offers");
    setOpen(false);
  }

  const toggle = (list: string[], set: (v: string[]) => void, k: string) =>
    set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Filters"
        className="relative grid size-11 place-items-center rounded-xl border-2 border-ink bg-white"
      >
        <span aria-hidden className="text-lg">⚙</span>
        {activeCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-ink bg-money text-[0.6rem] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40">
          <div className="w-full max-w-[430px] rounded-t-3xl border-t-2 border-ink bg-cream p-5">
            <div className="flex items-center justify-between">
              <h2 className="title-hand text-2xl">Filters</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-2xl">×</button>
            </div>

            <div className="mt-4 space-y-4">
              <Field label="Location">
                <input className="ink-input" value={location} placeholder="Any city"
                  onChange={(e) => setLocation(e.target.value)} />
              </Field>
              <Field label="Minimum pay" hint="Per month, €">
                <input className="ink-input" inputMode="numeric" value={minPay}
                  onChange={(e) => setMinPay(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Contract type">
                <div className="flex flex-wrap gap-2">
                  {[["internship","Internship"],["part_time","Part-time"],["full_time","Full-time"]].map(([k,l]) => (
                    <button key={k} onClick={() => toggle(contract, setContract, k!)}
                      className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm ${contract.includes(k!) ? "bg-money text-white" : "bg-white"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Remote">
                <div className="flex flex-wrap gap-2">
                  {[["remote","Remote"],["hybrid","Hybrid"],["on_site","On-site"]].map(([k,l]) => (
                    <button key={k} onClick={() => toggle(remote, setRemote, k!)}
                      className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm ${remote.includes(k!) ? "bg-money text-white" : "bg-white"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-5 flex gap-3 pb-4">
              <Button onClick={clear} className="flex-1">Clear</Button>
              <Button tone="money" onClick={apply} className="flex-[2]">Show jobs</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
