import "server-only";

import type {
  CvRead, MatchResult, IdCheck, ProofCheck, ReviewScreen, RejectionSummary,
} from "./schemas";

/**
 * The offline engine.
 *
 * Every AI task has a deterministic implementation here. It runs when there
 * is no ANTHROPIC_API_KEY, when the API cannot be reached, or when a reply
 * fails schema validation — so the app is always usable and never half-broken.
 *
 * Two of these are genuinely as good as the model: the rejection summary is
 * pure aggregation, and proof-of-work matching is string search over extracted
 * text. Two are weaker but honest: the CV reader is keyword-based, and match
 * scoring is a transparent weighted rule set. One cannot be done at all
 * without a vision model — the ID photo check — and it fails closed.
 *
 * Results are labelled `engine: "offline"` all the way to the UI, so nobody is
 * told a rule ran when a model did, or the reverse.
 */

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------
const KNOWN_SKILLS = [
  "excel","word","powerpoint","python","javascript","typescript","java","c++","c#",
  "sql","postgres","mysql","r","matlab","sap","salesforce","photoshop","illustrator",
  "indesign","figma","canva","autocad","solidworks","react","node","html","css",
  "git","docker","aws","azure","tableau","power bi","looker","spss","stata",
  "accounting","bookkeeping","payroll","invoicing","customer service","sales",
  "marketing","seo","copywriting","social media","content","data analysis",
  "data entry","research","project management","scrum","agile","teamwork",
  "communication","presentation","negotiation","time management","leadership",
  "problem solving","teaching","tutoring","first aid","driving licence",
  "cash handling","stock control","barista","food safety","translation",
];

const LANGUAGES = [
  "english","spanish","french","german","italian","portuguese","dutch","polish",
  "romanian","arabic","mandarin","chinese","japanese","korean","russian","turkish",
  "hindi","urdu","bengali","swedish","norwegian","danish","finnish","greek",
  "czech","hungarian","catalan","basque","galician","ukrainian",
];

function norm(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function uniq<T>(xs: T[]) {
  return Array.from(new Set(xs));
}

function listSentence(items: string[]) {
  const titled = items.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()));
  if (titled.length === 0) return "";
  if (titled.length === 1) return titled[0]!;
  if (titled.length === 2) return `${titled[0]} and ${titled[1]}`;
  return `${titled.slice(0, -1).join(", ")} and ${titled.at(-1)}`;
}

// ---------------------------------------------------------------------------
// 1. CV reader
// ---------------------------------------------------------------------------
export function offlineCvRead(text: string): CvRead {
  const lower = norm(text);
  const blank: string[] = [];

  // --- skills: look for known terms, and guess a level from nearby words ---
  const skills = KNOWN_SKILLS.filter((s) => lower.includes(s)).slice(0, 25).map((name) => {
    const at = lower.indexOf(name);
    const around = lower.slice(Math.max(0, at - 60), at + name.length + 60);
    const level: "basic" | "good" | "advanced" =
      /advanced|expert|fluent|native|proficient|excellent/.test(around) ? "advanced"
      : /intermediate|good|solid|working/.test(around) ? "good"
      : "basic";
    return { name, level };
  });
  if (skills.length === 0) blank.push("skills");

  // --- languages with CEFR level if stated --------------------------------
  const languages = LANGUAGES.filter((l) => lower.includes(l)).slice(0, 8).map((language) => {
    const at = lower.indexOf(language);
    const around = lower.slice(at, at + 90);
    const cefr = around.match(/\b(a1|a2|b1|b2|c1|c2)\b/i)?.[1]?.toUpperCase();
    const level = (cefr ?? (/native|mother tongue/.test(around) ? "native" : "B2")) as
      CvRead["languages"][number]["level"];
    return { language, level };
  });
  if (languages.length === 0) blank.push("languages");

  // --- education ----------------------------------------------------------
  const level: CvRead["education"][number]["level"] =
    /\bphd|doctorate\b/.test(lower) ? "other"
    : /master|msc|m\.sc|mba/.test(lower) ? "masters"
    : /bachelor|bsc|b\.sc|ba\b|degree|university|universidad|universit/.test(lower) ? "bachelors"
    : /high school|secondary|baccalaureate|bachillerato|a-level/.test(lower) ? "high_school"
    : null;

  const years = uniq(
    Array.from(text.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)).map((m) => Number(m[1])),
  ).sort((a, b) => a - b);

  const schoolLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /universit|college|school|institute|academy|escuela|facult/i.test(l) && l.length < 120);

  const education = level || schoolLine
    ? [{
        level,
        school: schoolLine ?? null,
        field: null,
        start_year: years.at(0) ?? null,
        end_year: years.at(-1) ?? null,
      }]
    : [];
  if (education.length === 0) blank.push("education");
  if (education[0] && !education[0].field) blank.push("education.field");

  // --- experience ---------------------------------------------------------
  // Lines that look like "Role at Company" or "Role — Company, 2023".
  const experience: CvRead["experience"] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 8 || line.length > 140) continue;
    const m = line.match(/^(.{3,70}?)\s*(?:\bat\b|[—–|,-])\s*(.{2,60}?)(?:\s*[,(]\s*(\d{4}))?$/i);
    if (!m) continue;
    if (!/intern|assistant|developer|engineer|analyst|manager|sales|support|waiter|clerk|designer|teacher|tutor|volunteer|barista|cashier|researcher|consultant/i.test(line)) continue;
    experience.push({
      job_title: m[1]!.trim(),
      company: m[2]!.trim(),
      start_month: m[3] ? `${m[3]}-01` : null,
      end_month: null,
      description: null,
    });
    if (experience.length >= 6) break;
  }
  if (experience.length === 0) blank.push("experience");
  else blank.push("experience.description", "experience.dates");

  // --- certificates -------------------------------------------------------
  const certificates: CvRead["certificates"] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/certificat|diploma|course|licen[cs]e|toefl|ielts|dele|goethe|delf/i.test(line)) continue;
    if (line.length < 4 || line.length > 140) continue;
    certificates.push({
      name: line,
      issuer: null,
      year: line.match(/\b(20[0-4]\d)\b/)?.[1] ? Number(line.match(/\b(20[0-4]\d)\b/)![1]) : null,
    });
    if (certificates.length >= 6) break;
  }

  // --- preferences: a CV rarely states these, so leave them for the user --
  blank.push(
    "preferences.roles", "preferences.cities", "preferences.contract_types",
    "preferences.min_pay", "preferences.work_modes", "preferences.earliest_start",
  );

  return {
    education,
    experience,
    skills,
    languages,
    certificates,
    preferences: {
      roles: [], cities: [], contract_types: [],
      min_pay: null, work_modes: [], earliest_start: null,
    },
    blank_fields: uniq(blank).slice(0, 40),
    contained_instructions: /ignore (all |the )?(previous|above)|system prompt|you are an ai|disregard (all|the)/i.test(text),
  };
}

// ---------------------------------------------------------------------------
// 2. Match score and reason
// ---------------------------------------------------------------------------
export type MatchInputs = {
  skills: { name: string; level: string }[];
  languages: { language: string; level: string }[];
  preferences: {
    roles: string[]; cities: string[]; contract_types: string[];
    min_pay: number | null; work_modes: string[];
  };
  job: {
    title: string; location: string; contract_type: string; work_mode: string;
    pay_min: number | null; skills_wanted: string[]; languages_wanted: string[];
  };
};

/**
 * Transparent weighted rules. Only job-relevant signals are used — there is
 * no path for age, gender, nationality or a photo to reach this function,
 * because the caller strips them before building MatchInputs.
 */
export function offlineMatch(input: MatchInputs): MatchResult {
  const { job, preferences: prefs } = input;
  const mySkills = new Map(input.skills.map((s) => [norm(s.name), s.level]));
  const myLangs = new Map(input.languages.map((l) => [norm(l.language), l.level]));

  const wantedSkills = job.skills_wanted.map(norm);
  const wantedLangs = job.languages_wanted.map(norm);

  const matchedSkills = wantedSkills.filter((s) => mySkills.has(s));
  const matchedLanguages = wantedLangs.filter((l) => myLangs.has(l));

  // Skills, 45 points. An advanced skill counts a little more than a basic one.
  const skillRatio = wantedSkills.length
    ? matchedSkills.reduce((acc, s) => {
        const lvl = mySkills.get(s);
        return acc + (lvl === "advanced" ? 1 : lvl === "good" ? 0.85 : 0.7);
      }, 0) / wantedSkills.length
    : 0.5;
  let score = skillRatio * 45;

  // Languages, 20 points.
  score += (wantedLangs.length
    ? matchedLanguages.length / wantedLangs.length
    : 0.5) * 20;

  // Location, 12.
  const cityHit = prefs.cities.some((c) => norm(job.location).includes(norm(c)));
  if (cityHit) score += 12;
  else if (job.work_mode === "remote") score += 8;
  else if (prefs.cities.length === 0) score += 6;

  // Contract type, 10.
  if (prefs.contract_types.length === 0) score += 5;
  else if (prefs.contract_types.includes(job.contract_type)) score += 10;

  // Work mode, 6.
  if (prefs.work_modes.length === 0) score += 3;
  else if (prefs.work_modes.includes(job.work_mode)) score += 6;

  // Pay, 7.
  if (prefs.min_pay == null) score += 3.5;
  else if (job.pay_min != null && job.pay_min >= prefs.min_pay) score += 7;

  // Desired role in the title, 10.
  const roleHit = prefs.roles.find((r) => norm(job.title).includes(norm(r)));
  if (roleHit) score += 10;
  else if (prefs.roles.length === 0) score += 4;

  const final = Math.max(0, Math.min(100, Math.round(score)));

  // One plain sentence naming the matching skills or languages.
  let reason: string;
  const named = [...matchedSkills.slice(0, 2), ...matchedLanguages.slice(0, 1)];
  if (named.length) {
    reason = `Matches your ${listSentence(named)}`;
    if (roleHit) reason += `, and you asked for ${roleHit} roles`;
    else if (cityHit) reason += `, and it is in ${job.location}`;
    reason += ".";
  } else if (roleHit) {
    reason = `You asked for ${roleHit} roles, and this is one.`;
  } else if (job.work_mode === "remote") {
    reason = "Remote, and open to people early in their career.";
  } else {
    reason = `An entry-level opening in ${job.location}.`;
  }

  return {
    score: final,
    reason: reason.slice(0, 200),
    matched_skills: matchedSkills.slice(0, 8),
    matched_languages: matchedLanguages.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// 3. ID photo check — cannot be done offline, so it fails closed.
// ---------------------------------------------------------------------------
export function offlineIdCheck(): IdCheck {
  return {
    is_id_document: false,
    document_type: "none",
    all_corners_visible: false,
    text_readable: false,
    blur_or_glare: true,
    date_of_birth: null,
    full_name: null,
    reason:
      "The photo could not be checked: no AI image check is available on this " +
      "deployment. Nothing about your photo was wrong — the check itself is off. " +
      "Use the electronic ID route instead, or ask the operator to configure the key.",
  };
}

// ---------------------------------------------------------------------------
// 4. Proof of work pre-check — string matching over the extracted text.
// ---------------------------------------------------------------------------
export function offlineProofCheck(args: {
  text: string;
  company: string;
  personName: string;
  monthsWorked: number;
}): ProofCheck {
  const hay = norm(args.text);
  const company = norm(args.company).replace(/\b(ltd|sl|sa|gmbh|bv|inc|llc|co)\b/g, "").trim();
  const nameParts = norm(args.personName).split(/\s+/).filter((p) => p.length > 2);

  const companyFound = company.length > 2 && hay.includes(company);
  // Every part of the name has to appear, not just one common first name.
  const nameFound = nameParts.length > 0 && nameParts.every((p) => hay.includes(p));

  const dates = Array.from(
    args.text.matchAll(/\b(0?[1-9]|1[0-2])[\/.-](19|20)\d{2}\b|\b(19|20)\d{2}-\d{2}\b|\b(19|20)\d{2}\b/g),
  ).map((m) => m[0]);

  const kind: ProofCheck["document_kind"] =
    args.text.trim().length < 40 ? "unreadable"
    : /payslip|payroll|n[oó]mina|salary slip/i.test(args.text) ? "payslip"
    : /internship agreement|convenio de pr[aá]cticas|learning agreement/i.test(args.text) ? "internship_agreement"
    : /certificat|certificado|attestation/i.test(args.text) ? "certificate"
    : /reference|recommendation|referencia/i.test(args.text) ? "reference_letter"
    : /contract|contrato|arbeitsvertrag/i.test(args.text) ? "contract"
    : /@/.test(args.text) ? "work_email"
    : "other";

  const notes: string[] = [];
  notes.push(companyFound ? "Company name found in the document." : "Company name NOT found.");
  notes.push(nameFound ? "Reviewer's name found." : "Reviewer's name NOT found.");
  notes.push(dates.length ? `Dates found: ${uniq(dates).slice(0, 6).join(", ")}.` : "No dates found.");
  notes.push(`Document looks like: ${kind.replace(/_/g, " ")}.`);
  notes.push("Checked by the offline engine (no AI). Please read the document yourself.");

  return {
    company_name_found: companyFound,
    person_name_found: nameFound,
    dates_found: dates.length > 0,
    start_date: uniq(dates).at(0) ?? null,
    end_date: uniq(dates).at(-1) ?? null,
    document_kind: kind,
    moderator_note: notes.join(" ").slice(0, 600),
  };
}

// ---------------------------------------------------------------------------
// 5. Review pre-screen
// ---------------------------------------------------------------------------
const INSULTS = [
  "idiot","idiots","stupid","moron","scum","trash","garbage","incompetent",
  "liar","liars","crook","crooks","disgusting","pathetic","useless","clown",
  "scam","scammers","thief","thieves","racist","sexist","abusive","bully",
];

const TITLE_WORDS = /\b(?:my |the )?(?:manager|boss|supervisor|ceo|cto|hr|director|team lead|owner)\b/i;

export function offlineReviewScreen(text: string): ReviewScreen {
  const lower = norm(text);
  const flags: string[] = [];

  const insults = INSULTS.filter((w) => new RegExp(`\\b${w}\\b`).test(lower));
  if (insults.length) flags.push(`possible insults: ${insults.slice(0, 4).join(", ")}`);

  // Personal data: emails, phone numbers, long digit runs (IDs, IBANs).
  const email = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text);
  const phone = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,}/.test(text);
  const idish = /\b[A-Z0-9]{8,}\b/.test(text);
  const personalData = email || phone || idish;
  if (email) flags.push("an email address");
  if (phone) flags.push("a phone number");
  if (idish) flags.push("a long identifier");

  // Named individuals: a capitalised two-word name, or a job title plus a name.
  const capitalisedName = /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(text);
  const titledPerson = TITLE_WORDS.test(text) && /\b[A-Z][a-z]{2,}\b/.test(text);
  const personalNames = capitalisedName || titledPerson;
  if (personalNames) flags.push("what may be a person's name");

  // Off-topic: too short to be about a job, or clearly about something else.
  const offTopic =
    text.trim().length < 40 ||
    /\b(buy now|click here|crypto|casino|free money|subscribe|discount code|https?:\/\/)/i.test(text);
  if (offTopic) flags.push("off-topic or promotional content");

  return {
    personal_names: personalNames,
    insults: insults.length > 0,
    personal_data: personalData,
    off_topic: offTopic,
    note: flags.length
      ? `Offline pre-screen flagged: ${flags.join("; ")}.`
      : "Offline pre-screen found nothing to flag.",
  };
}

// ---------------------------------------------------------------------------
// 6. Rejection summary — pure aggregation, patterns only, no advice.
// ---------------------------------------------------------------------------
const STAGE_LABEL: Record<string, string> = {
  cv_screen: "the CV screen",
  assessment: "the assessment",
  interview: "the interview",
  final_round: "the final round",
};

export function offlineRejectionSummary(input: {
  total: number;
  byStage: Record<string, number>;
  roleTypes: { title: string; n: number }[];
  skills: { name: string; n: number }[];
}): RejectionSummary {
  const { total, byStage, roleTypes, skills } = input;

  if (total === 0) {
    return {
      most_common_stage: "none",
      recurring_skills: [],
      recurring_role_types: [],
      summary: "No rejections logged yet. Once you log a few, patterns will show here.",
    };
  }

  const ranked = Object.entries(byStage).sort((a, b) => b[1] - a[1]);
  const [topStage, topCount] = ranked[0] ?? ["cv_screen", 0];

  const recurringRoles = roleTypes.filter((r) => r.n > 1).map((r) => r.title);
  const recurringSkills = skills.filter((s) => s.n > 1).map((s) => s.name);

  const sentences: string[] = [];
  sentences.push(
    `Most of your rejections — ${topCount} of ${total} — happen at ${STAGE_LABEL[topStage] ?? topStage}.`,
  );
  if (recurringRoles.length) {
    sentences.push(`They come up most in ${listSentence(recurringRoles.slice(0, 3))} roles.`);
  }
  if (recurringSkills.length) {
    sentences.push(
      `${listSentence(recurringSkills.slice(0, 3))} appear repeatedly in the listings involved.`,
    );
  }
  if (sentences.length === 1) {
    sentences.push("No role type or skill repeats often enough to be a pattern yet.");
  }

  return {
    most_common_stage: (topStage in STAGE_LABEL ? topStage : "none") as RejectionSummary["most_common_stage"],
    recurring_skills: recurringSkills.slice(0, 6),
    recurring_role_types: recurringRoles.slice(0, 5),
    summary: sentences.join(" ").slice(0, 400),
  };
}
