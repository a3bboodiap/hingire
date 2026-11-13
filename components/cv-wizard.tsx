"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice, Pill } from "@/components/ui";

const SUGGESTED_SKILLS = [
  "Excel", "Word", "PowerPoint", "Python", "SQL", "Customer service",
  "Teamwork", "Communication", "Social media", "Canva", "Photoshop",
  "Data entry", "Sales", "Research", "Time management",
];
const STEP_NAMES = [
  "Education", "Experience", "Skills", "Languages", "Certificates", "Preferences",
];
const LANG_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "native"] as const;

type Any = Record<string, unknown>;
export type CvData = {
  education: Any[]; experience: Any[]; skills: Any[]; languages: Any[];
  certificates: Any[]; preferences: Any | null; progress: Any | null;
};

export function CvWizard({ initial }: { initial: CvData }) {
  const router = useRouter();
  const blanks: string[] = (initial.progress?.blank_fields as string[]) ?? [];
  const [step, setStep] = useState<number>(
    Math.min(7, Number(initial.progress?.current_step ?? 1)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const [edu, setEdu] = useState<Any[]>(
    initial.education.length ? initial.education : [{}],
  );
  const [exp, setExp] = useState<Any[]>(
    initial.experience.length ? initial.experience : [{}],
  );
  const [noExp, setNoExp] = useState(false);
  const [skills, setSkills] = useState<Any[]>(initial.skills);
  const [langs, setLangs] = useState<Any[]>(
    initial.languages.length ? initial.languages : [{}],
  );
  const [certs, setCerts] = useState<Any[]>(initial.certificates);
  const [prefs, setPrefs] = useState<Any>(
    initial.preferences ?? {
      roles: [], cities: [], contract_types: [], min_pay: null, work_modes: [],
    },
  );

  const isBlank = (k: string) => blanks.includes(k);

  async function save(n: number) {
    setBusy(true); setError(null);
    const bodies: Record<number, unknown> = {
      1: { step: 1, items: edu.filter((e) => Object.keys(e).length).map(clean1) },
      2: { step: 2, none: noExp, items: noExp ? [] : exp.filter((e) => Object.keys(e).length).map(clean2) },
      3: { step: 3, items: skills },
      4: { step: 4, items: langs.filter((l) => l.language) },
      5: { step: 5, items: certs.filter((c) => c.name) },
      6: { step: 6, preferences: cleanPrefs(prefs) },
    };
    try {
      const res = await fetch("/api/cv/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodies[n]),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Could not save.");
        return false;
      }
      return true;
    } catch {
      setError("No connection. Your answers are kept on this screen — try again.");
      return false;
    } finally { setBusy(false); }
  }

  async function next() {
    if (step <= 6 && !(await save(step))) return;
    setStep(step + 1);
    window.scrollTo(0, 0);
  }

  async function finish() {
    setBusy(true);
    try {
      const res = await fetch("/api/cv/complete", { method: "POST" });
      const j = await res.json();
      if (res.ok) { router.push(j.data.next); router.refresh(); }
      else setError(j.error ?? "Could not finish.");
    } finally { setBusy(false); }
  }

  async function upload(file: File) {
    setBusy(true); setError(null); setUploadNote(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/cv/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "We could not read that file."); return; }
      setUploadNote(
        j.data.engine === "claude"
          ? "Read by AI. Check every answer — anything it could not find is highlighted."
          : "Read by the built-in offline reader (no AI key set). Check every answer carefully.",
      );
      router.refresh();
      setStep(7);
    } catch {
      setError("Upload failed. Check your connection.");
    } finally { setBusy(false); }
  }

  const pct = Math.round((Math.min(step, 7) / 7) * 100);

  return (
    <div className="pb-8">
      {/* Progress */}
      <div className="sticky top-0 z-10 -mx-5 bg-cream/95 px-5 pb-3 pt-2 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">
            {step <= 6 ? `Step ${step} of 6` : "Check your answers"}
          </p>
          <p className="text-xs text-ink-soft">{step <= 6 ? STEP_NAMES[step - 1] : "Summary"}</p>
        </div>
        <div className="mt-1.5 h-2.5 w-full rounded-full border-2 border-ink bg-white">
          <div className="h-full rounded-full bg-money transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error ? <div className="mt-4"><Notice tone="danger">{error}</Notice></div> : null}
      {uploadNote ? <div className="mt-4"><Notice tone="gold" title="From your CV">{uploadNote}</Notice></div> : null}

      <div className="mt-5 space-y-4">
        {/* ---- Step 1: Education ---- */}
        {step === 1 && (
          <>
            {edu.map((row, i) => (
              <div key={i} className="ink-card-flat space-y-3 p-4">
                <Field label="Level">
                  <select className="ink-input" value={(row.level as string) ?? ""}
                    onChange={(e) => upd(setEdu, edu, i, { level: e.target.value || null })}>
                    <option value="">Choose…</option>
                    <option value="high_school">High school</option>
                    <option value="bachelors">Bachelor’s</option>
                    <option value="masters">Master’s</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="School or university">
                  <input className="ink-input" value={(row.school as string) ?? ""}
                    onChange={(e) => upd(setEdu, edu, i, { school: e.target.value })} />
                </Field>
                <Field label="Field of study" highlight={isBlank("education.field")}>
                  <input className={`ink-input ${isBlank("education.field") ? "field-blank" : ""}`}
                    value={(row.field as string) ?? ""}
                    onChange={(e) => upd(setEdu, edu, i, { field: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start year">
                    <input className="ink-input" inputMode="numeric" value={(row.start_year as string) ?? ""}
                      onChange={(e) => upd(setEdu, edu, i, { start_year: num(e.target.value) })} />
                  </Field>
                  <Field label="End year">
                    <input className="ink-input" inputMode="numeric" value={(row.end_year as string) ?? ""}
                      onChange={(e) => upd(setEdu, edu, i, { end_year: num(e.target.value) })} />
                  </Field>
                </div>
                {edu.length > 1 && (
                  <button className="text-xs underline text-danger"
                    onClick={() => setEdu(edu.filter((_, n) => n !== i))}>Remove</button>
                )}
              </div>
            ))}
            <Button onClick={() => setEdu([...edu, {}])} full>+ Add another</Button>

            <div className="mt-6 rounded-xl border-2 border-dashed border-ink-faint p-4 text-center">
              <p className="text-sm font-semibold">In a hurry?</p>
              <label className="mt-2 inline-block cursor-pointer text-sm underline">
                Skip: upload my CV instead
                <input type="file" className="sr-only" accept=".pdf,.docx"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
              <p className="mt-1 text-xs text-ink-faint">
                PDF or Word, up to 5 MB. We read it, fill these steps in, and delete the file.
              </p>
            </div>
          </>
        )}

        {/* ---- Step 2: Experience ---- */}
        {step === 2 && (
          <>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-5" checked={noExp}
                onChange={(e) => setNoExp(e.target.checked)} />
              No experience yet
            </label>
            {!noExp && exp.map((row, i) => (
              <div key={i} className="ink-card-flat space-y-3 p-4">
                <Field label="Job title">
                  <input className="ink-input" value={(row.job_title as string) ?? ""}
                    onChange={(e) => upd(setExp, exp, i, { job_title: e.target.value })} />
                </Field>
                <Field label="Company">
                  <input className="ink-input" value={(row.company as string) ?? ""}
                    onChange={(e) => upd(setExp, exp, i, { company: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start" highlight={isBlank("experience.dates")}>
                    <input className="ink-input" type="month"
                      value={ym(row.start_month)}
                      onChange={(e) => upd(setExp, exp, i, { start_month: e.target.value })} />
                  </Field>
                  <Field label="End">
                    <input className="ink-input" type="month" value={ym(row.end_month)}
                      onChange={(e) => upd(setExp, exp, i, { end_month: e.target.value })} />
                  </Field>
                </div>
                <Field label="What you did" hint="Two or three lines."
                       highlight={isBlank("experience.description")}>
                  <textarea rows={3}
                    className={`ink-input ${isBlank("experience.description") ? "field-blank" : ""}`}
                    value={(row.description as string) ?? ""}
                    onChange={(e) => upd(setExp, exp, i, { description: e.target.value })} />
                </Field>
                {exp.length > 1 && (
                  <button className="text-xs underline text-danger"
                    onClick={() => setExp(exp.filter((_, n) => n !== i))}>Remove</button>
                )}
              </div>
            ))}
            {!noExp && <Button onClick={() => setExp([...exp, {}])} full>+ Add another</Button>}
          </>
        )}

        {/* ---- Step 3: Skills ---- */}
        {step === 3 && (
          <>
            <p className="text-sm text-ink-soft">Tap a skill, or type your own.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_SKILLS.filter((s) => !skills.some((k) => k.name === s)).map((s) => (
                <button key={s} onClick={() => setSkills([...skills, { name: s, level: "basic" }])}
                  className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm">
                  + {s}
                </button>
              ))}
            </div>
            <AddOwn placeholder="Add your own skill"
              onAdd={(v) => !skills.some((k) => k.name === v) && setSkills([...skills, { name: v, level: "basic" }])} />
            <div className="space-y-2">
              {skills.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white p-2">
                  <span className="flex-1 text-sm font-medium">{s.name as string}</span>
                  <select className="rounded-lg border-2 border-ink px-2 py-1 text-xs"
                    value={s.level as string}
                    onChange={(e) => upd(setSkills, skills, i, { level: e.target.value })}>
                    <option value="basic">basic</option>
                    <option value="good">good</option>
                    <option value="advanced">advanced</option>
                  </select>
                  <button className="px-1 text-danger" aria-label={`Remove ${s.name}`}
                    onClick={() => setSkills(skills.filter((_, n) => n !== i))}>×</button>
                </div>
              ))}
              {skills.length === 0 ? (
                <p className="text-sm text-ink-faint">No skills yet. Add a few — this is what matching uses most.</p>
              ) : null}
            </div>
          </>
        )}

        {/* ---- Step 4: Languages ---- */}
        {step === 4 && (
          <>
            {langs.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input className="ink-input flex-1" placeholder="Language"
                  value={(row.language as string) ?? ""}
                  onChange={(e) => upd(setLangs, langs, i, { language: e.target.value })} />
                <select className="ink-input w-28" value={(row.level as string) ?? "B2"}
                  onChange={(e) => upd(setLangs, langs, i, { level: e.target.value })}>
                  {LANG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {langs.length > 1 && (
                  <button className="px-2 text-danger" aria-label="Remove language"
                    onClick={() => setLangs(langs.filter((_, n) => n !== i))}>×</button>
                )}
              </div>
            ))}
            <Button onClick={() => setLangs([...langs, { level: "B2" }])} full>+ Add another</Button>
          </>
        )}

        {/* ---- Step 5: Certificates ---- */}
        {step === 5 && (
          <>
            <p className="text-sm text-ink-soft">Optional — skip if you have none.</p>
            {certs.map((row, i) => (
              <div key={i} className="ink-card-flat space-y-3 p-4">
                <Field label="Name">
                  <input className="ink-input" value={(row.name as string) ?? ""}
                    onChange={(e) => upd(setCerts, certs, i, { name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Issued by">
                    <input className="ink-input" value={(row.issuer as string) ?? ""}
                      onChange={(e) => upd(setCerts, certs, i, { issuer: e.target.value })} />
                  </Field>
                  <Field label="Year">
                    <input className="ink-input" inputMode="numeric" value={(row.year as string) ?? ""}
                      onChange={(e) => upd(setCerts, certs, i, { year: num(e.target.value) })} />
                  </Field>
                </div>
                <button className="text-xs underline text-danger"
                  onClick={() => setCerts(certs.filter((_, n) => n !== i))}>Remove</button>
              </div>
            ))}
            <Button onClick={() => setCerts([...certs, {}])} full>+ Add a certificate</Button>
          </>
        )}

        {/* ---- Step 6: Preferences ---- */}
        {step === 6 && (
          <>
            <Field label="Roles you want" hint="Press Enter after each one.">
              <TagInput value={(prefs.roles as string[]) ?? []}
                onChange={(v) => setPrefs({ ...prefs, roles: v })} placeholder="Marketing intern" />
            </Field>
            <Field label="Cities">
              <TagInput value={(prefs.cities as string[]) ?? []}
                onChange={(v) => setPrefs({ ...prefs, cities: v })} placeholder="Madrid" />
            </Field>
            <Field label="Contract type">
              <Choices options={[["internship","Internship"],["part_time","Part-time"],["full_time","Full-time"]]}
                value={(prefs.contract_types as string[]) ?? []}
                onChange={(v) => setPrefs({ ...prefs, contract_types: v })} />
            </Field>
            <Field label="Minimum pay" hint="Per month, before tax. Leave blank if it does not matter.">
              <input className="ink-input" inputMode="numeric"
                value={(prefs.min_pay as string) ?? ""}
                onChange={(e) => setPrefs({ ...prefs, min_pay: num(e.target.value) })} />
            </Field>
            <Field label="Remote, hybrid or on-site">
              <Choices options={[["remote","Remote"],["hybrid","Hybrid"],["on_site","On-site"]]}
                value={(prefs.work_modes as string[]) ?? []}
                onChange={(v) => setPrefs({ ...prefs, work_modes: v })} />
            </Field>
            <Field label="Earliest start date">
              <input className="ink-input" type="date"
                value={(prefs.earliest_start as string) ?? ""}
                onChange={(e) => setPrefs({ ...prefs, earliest_start: e.target.value || null })} />
            </Field>
          </>
        )}

        {/* ---- Step 7: Summary ---- */}
        {step === 7 && (
          <div className="space-y-3">
            {([
              ["Education", 1, edu.map((e) => [e.school, e.field].filter(Boolean).join(" — "))],
              ["Experience", 2, noExp ? ["No experience yet"] : exp.map((e) => [e.job_title, e.company].filter(Boolean).join(" at "))],
              ["Skills", 3, [skills.map((s) => s.name).join(", ")]],
              ["Languages", 4, langs.filter((l) => l.language).map((l) => `${l.language} (${l.level})`)],
              ["Certificates", 5, certs.map((c) => c.name as string)],
              ["Preferences", 6, [
                ((prefs.roles as string[]) ?? []).join(", "),
                ((prefs.cities as string[]) ?? []).join(", "),
              ].filter(Boolean)],
            ] as [string, number, unknown[]][]).map(([name, n, items]) => (
              <div key={name} className="ink-card-flat p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{name}</p>
                  <button className="text-sm underline" onClick={() => setStep(n)}>Edit</button>
                </div>
                <div className="mt-1 text-sm text-ink-soft">
                  {items.filter(Boolean).length
                    ? items.filter(Boolean).map((t, i) => <p key={i}>{String(t)}</p>)
                    : <p className="text-ink-faint">Nothing added</p>}
                </div>
              </div>
            ))}
            {blanks.length ? (
              <Notice tone="gold" title="Check the highlighted fields">
                We could not find these in your CV: {blanks.slice(0, 6).join(", ")}
                {blanks.length > 6 ? "…" : ""}
              </Notice>
            ) : null}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <Button onClick={() => setStep(step - 1)} className="flex-1">Back</Button>
        )}
        {step <= 6 ? (
          <Button tone="money" onClick={next} disabled={busy} className="flex-[2]">
            {busy ? "Saving…" : "Next"}
          </Button>
        ) : (
          <Button tone="money" onClick={finish} disabled={busy} className="flex-[2]">
            {busy ? "Finding…" : "Find my matches"}
          </Button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Your answers are saved after every step.
      </p>
    </div>
  );
}

/* ---------- small helpers ---------- */
function upd(setter: (v: Any[]) => void, list: Any[], i: number, patch: Any) {
  setter(list.map((row, n) => (n === i ? { ...row, ...patch } : row)));
}
function num(v: string) { const n = Number(v); return v && Number.isFinite(n) ? n : null; }
function ym(v: unknown) { return typeof v === "string" ? v.slice(0, 7) : ""; }
function clean1(e: Any) {
  return { level: e.level ?? null, school: e.school ?? "", field: e.field ?? "",
           start_year: e.start_year ?? null, end_year: e.end_year ?? null };
}
function clean2(e: Any) {
  return { job_title: e.job_title ?? "", company: e.company ?? "",
           start_month: ym(e.start_month) || null, end_month: ym(e.end_month) || null,
           description: e.description ?? "" };
}
function cleanPrefs(p: Any) {
  return {
    roles: (p.roles as string[]) ?? [], cities: (p.cities as string[]) ?? [],
    contract_types: (p.contract_types as string[]) ?? [],
    min_pay: (p.min_pay as number) ?? null,
    work_modes: (p.work_modes as string[]) ?? [],
    earliest_start: (p.earliest_start as string) || null,
  };
}

function AddOwn({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input className="ink-input flex-1" placeholder={placeholder} value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } } }} />
      <button type="button" className="ink-btn shrink-0 bg-white px-3"
        onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(""); } }}>Add</button>
    </div>
  );
}

function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [v, setV] = useState("");
  return (
    <div>
      <div className="flex gap-2">
        <input className="ink-input flex-1" placeholder={placeholder} value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (v.trim() && !value.includes(v.trim())) onChange([...value, v.trim()]);
              setV("");
            }
          }} />
        <button type="button" className="ink-btn shrink-0 bg-white px-3"
          onClick={() => { if (v.trim() && !value.includes(v.trim())) { onChange([...value, v.trim()]); setV(""); } }}>
          Add
        </button>
      </div>
      {value.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((t) => (
            <button key={t} onClick={() => onChange(value.filter((x) => x !== t))}
              className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm">
              {t} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Choices({ options, value, onChange }: {
  options: [string, string][]; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => {
        const on = value.includes(k);
        return (
          <button key={k} type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}
            className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm ${on ? "bg-money text-white" : "bg-white"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export { Pill };
