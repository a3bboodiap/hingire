import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CvRead } from "@/lib/ai/schemas";

type DB = SupabaseClient<Database>;

/** Replace one step's rows for a user. Scoped by user_id on every statement. */
export async function saveStep(db: DB, userId: string, step: number, payload: unknown) {
  const p = payload as Record<string, unknown>;
  switch (step) {
    case 1: {
      await db.from("cv_education").delete().eq("user_id", userId);
      const items = (p.items as Record<string, unknown>[]) ?? [];
      if (items.length) {
        await db.from("cv_education").insert(
          items.map((i, n) => ({ ...i, user_id: userId, sort_order: n })) as never,
        );
      }
      break;
    }
    case 2: {
      await db.from("cv_experience").delete().eq("user_id", userId);
      const items = (p.items as Record<string, unknown>[]) ?? [];
      if (items.length && !p.none) {
        await db.from("cv_experience").insert(
          items.map((i, n) => ({
            ...i, user_id: userId, sort_order: n,
            start_month: i.start_month ? `${i.start_month}-01` : null,
            end_month: i.end_month ? `${i.end_month}-01` : null,
          })) as never,
        );
      }
      break;
    }
    case 3: {
      await db.from("cv_skills").delete().eq("user_id", userId);
      const items = (p.items as Record<string, unknown>[]) ?? [];
      if (items.length) {
        await db.from("cv_skills").insert(
          items.map((i) => ({ ...i, user_id: userId })) as never,
        );
      }
      break;
    }
    case 4: {
      await db.from("cv_languages").delete().eq("user_id", userId);
      const items = (p.items as Record<string, unknown>[]) ?? [];
      if (items.length) {
        await db.from("cv_languages").insert(
          items.map((i) => ({ ...i, user_id: userId })) as never,
        );
      }
      break;
    }
    case 5: {
      await db.from("cv_certificates").delete().eq("user_id", userId);
      const items = (p.items as Record<string, unknown>[]) ?? [];
      if (items.length) {
        await db.from("cv_certificates").insert(
          items.map((i) => ({ ...i, user_id: userId })) as never,
        );
      }
      break;
    }
    case 6: {
      await db.from("cv_preferences").upsert({
        ...(p.preferences as object), user_id: userId,
      } as never);
      break;
    }
  }
}

/** Write everything the CV reader found, in one go. */
export async function saveCvRead(db: DB, userId: string, cv: CvRead) {
  await saveStep(db, userId, 1, { items: cv.education });
  await saveStep(db, userId, 2, { items: cv.experience });
  await saveStep(db, userId, 3, { items: cv.skills });
  await saveStep(db, userId, 4, { items: cv.languages });
  await saveStep(db, userId, 5, { items: cv.certificates });
  await saveStep(db, userId, 6, { preferences: cv.preferences });
  await db.from("cv_progress").upsert({
    user_id: userId,
    current_step: 7,
    completed_steps: [1, 2, 3, 4, 5],
    blank_fields: cv.blank_fields,
    filled_from_cv: true,
  } as never);
}

/** Everything needed to render the questionnaire and the summary. */
export async function loadCv(db: DB, userId: string) {
  const [edu, exp, skills, langs, certs, prefs, progress] = await Promise.all([
    db.from("cv_education").select("*").eq("user_id", userId).order("sort_order"),
    db.from("cv_experience").select("*").eq("user_id", userId).order("sort_order"),
    db.from("cv_skills").select("*").eq("user_id", userId),
    db.from("cv_languages").select("*").eq("user_id", userId),
    db.from("cv_certificates").select("*").eq("user_id", userId),
    db.from("cv_preferences").select("*").eq("user_id", userId).maybeSingle(),
    db.from("cv_progress").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    education: edu.data ?? [],
    experience: exp.data ?? [],
    skills: skills.data ?? [],
    languages: langs.data ?? [],
    certificates: certs.data ?? [],
    preferences: prefs.data ?? null,
    progress: progress.data ?? null,
  };
}
