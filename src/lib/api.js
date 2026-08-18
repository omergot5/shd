// ============================================================
// Data access layer
//
// One place that knows the database column names. Everything above this file
// works with camelCase app objects, so a schema rename can't leak into the UI
// (which is exactly how the previous version broke: the cloud returned
// `start_time` while the components read `startTime`).
// ============================================================

import { supabase } from "./supabaseClient.js";

// ---------- row <-> app mappers ----------

const hhmm = (t) => String(t || "").slice(0, 5);

export const shiftFromRow = (row) => ({
  id: row.id,
  date: row.date,
  label: row.label,
  startTime: hhmm(row.start_time),
  endTime: hhmm(row.end_time),
  location: row.location || "",
  requiredGuards: row.required_guards ?? 1,
  type: row.type || "custom",
  color: row.color || "#3B82F6",
  published: Boolean(row.published),
  assignedGuards: (row.gs_assignments || []).map((a) => a.guard_id),
  assignmentMeta: Object.fromEntries(
    (row.gs_assignments || []).map((a) => [a.guard_id, { source: a.source, score: a.score, reason: a.reason }])
  ),
});

export const shiftToRow = (shift, teamCode) => ({
  ...(shift.id && !String(shift.id).startsWith("tmp") ? { id: shift.id } : {}),
  team_code: teamCode,
  date: shift.date,
  label: shift.label,
  start_time: shift.startTime,
  end_time: shift.endTime,
  location: shift.location || "כניסה ראשית",
  required_guards: shift.requiredGuards || 1,
  type: shift.type || "custom",
  color: shift.color || "#3B82F6",
  published: Boolean(shift.published),
});

export const profileFromRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.full_name,
  phone: row.phone || "",
  role: row.role,
  teamCode: row.team_code,
  isSupervisor: row.role === "supervisor",
});

export const availKey = (guardId, shiftId) => `${guardId}-${shiftId}`;

export const availabilityFromRows = (rows = []) =>
  Object.fromEntries(
    rows.map((r) => [availKey(r.guard_id, r.shift_id), { status: r.status, comment: r.comment || "" }])
  );

export const swapFromRow = (row) => ({
  id: row.id,
  shiftId: row.shift_id,
  fromGuard: row.from_guard,
  toGuard: row.to_guard,
  status: row.status,
  message: row.message || "",
  createdAt: row.created_at,
});

export const taskFromRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  assignedTo: row.assigned_to,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
});

// ---------- auth ----------

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

/** Resolve the signed-in user to a Smart Shift Management profile, if they have one. */
export async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("gs_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return profileFromRow(data);
}

const coded = (code, message) => {
  const err = new Error(message || code);
  err.code = code;
  return err;
};

/** Creates the team + supervisor profile for whoever is signed in right now. */
export async function createTeamForCurrentUser({ fullName, teamName }) {
  const { data: rows, error } = await supabase.rpc("gs_create_team", {
    p_team_name: teamName?.trim() || `הצוות של ${fullName?.trim() || 'האחמ"ש'}`,
    p_full_name: fullName?.trim() || "מנהל משמרת",
  });
  if (error) throw new Error("לא הצלחנו ליצור את הצוות — נסה שוב");
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { teamCode: row.team_code, profileId: row.profile_id };
}

export async function registerSupervisor({ email, password, fullName, teamName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw translateAuthError(error);

  // When "confirm email" is on, Supabase does not reveal that an address is
  // already taken — it returns a user with an empty `identities` array and no
  // session, which looks identical to a fresh signup. Without this check the
  // user is told to go and confirm an email that will never arrive.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw coded("ALREADY_REGISTERED", "האימייל הזה כבר רשום — התחבר במקום, או אפס סיסמה");
  }

  if (!data.session) throw coded("EMAIL_CONFIRMATION_REQUIRED");

  return createTeamForCurrentUser({ fullName, teamName });
}

export async function loginSupervisor({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw translateAuthError(error);

  const profile = await getMyProfile();
  // Authenticated, but with no team: either signup was interrupted, or the
  // account predates this schema. Previously a dead end — the app said
  // "register again", which cannot work because the address is already taken.
  // The caller now finishes onboarding instead.
  if (!profile) throw coded("NO_TEAM");
  return profile;
}

/**
 * Sends a recovery link. Always resolves, even for an address with no
 * account: telling a stranger which emails are registered is an
 * account-enumeration leak, so the UI says the same thing either way.
 */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: window.location.origin,
  });
  if (error && /rate limit|too many/i.test(error.message)) throw translateAuthError(error);
}

/** Sets a new password for the session opened by a recovery link. */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw translateAuthError(error);
}

export async function joinAsGuard({ teamCode, fullName }) {
  let session = await getSession();
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error("לא הצלחנו לפתוח כניסה — בדוק את החיבור לאינטרנט");
  }

  const { data: rows, error } = await supabase.rpc("gs_join_team", {
    p_code: teamCode.trim().toUpperCase(),
    p_full_name: fullName.trim(),
  });

  if (error) {
    if (/TEAM_NOT_FOUND/.test(error.message)) {
      throw new Error('קוד הצוות לא קיים — בדוק את הקוד מול האחמ"ש שלך');
    }
    if (/ALREADY_IN_ANOTHER_TEAM/.test(error.message)) {
      throw new Error("המכשיר הזה כבר משויך לצוות אחר. התנתק תחילה ונסה שוב");
    }
    throw new Error("ההצטרפות נכשלה — נסה שוב");
  }

  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    id: row.profile_id,
    teamCode: row.team_code,
    name: row.full_name,
    role: "guard",
    isSupervisor: false,
    // True when nobody on the roster matched this name. Usually a genuinely
    // new person — but it is also what a misspelling looks like, and this is
    // the last moment the guard can still correct it themselves.
    isNewProfile: row.created === true,
  };
}

export async function logout() {
  await supabase.auth.signOut();
}

function translateAuthError(error) {
  const msg = error?.message || "";
  if (/Invalid login credentials/i.test(msg)) return new Error("אימייל או סיסמה שגויים");
  if (/User already registered/i.test(msg)) return new Error("האימייל הזה כבר רשום — נסה להתחבר במקום");
  if (/Password should be at least/i.test(msg)) return new Error("הסיסמה חייבת להיות באורך 6 תווים לפחות");
  if (/email address.*invalid/i.test(msg)) return new Error("כתובת האימייל לא תקינה");
  if (/rate limit|too many/i.test(msg)) return new Error("יותר מדי ניסיונות — המתן דקה ונסה שוב");
  return new Error(msg || "שגיאה לא צפויה");
}

// ---------- team data ----------

export async function loadTeam(teamCode) {
  const [teamRes, profilesRes, shiftsRes, availRes, swapsRes, tasksRes] = await Promise.all([
    supabase.from("gs_teams").select("*").eq("code", teamCode).maybeSingle(),
    supabase.from("gs_profiles").select("*").eq("team_code", teamCode).order("created_at"),
    supabase.from("gs_shifts").select("*, gs_assignments(guard_id, source, score, reason)")
      .eq("team_code", teamCode).order("date"),
    supabase.from("gs_availability").select("*"),
    supabase.from("gs_swap_requests").select("*").eq("team_code", teamCode).order("created_at", { ascending: false }),
    supabase.from("gs_tasks").select("*").eq("team_code", teamCode).order("created_at", { ascending: false }),
  ]);

  const firstError = [teamRes, profilesRes, shiftsRes, availRes, swapsRes, tasksRes].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const profiles = (profilesRes.data || []).map(profileFromRow);

  return {
    team: teamRes.data ? { code: teamRes.data.code, name: teamRes.data.name, ownerId: teamRes.data.owner_id } : null,
    members: profiles,
    guards: profiles.filter((p) => p.role === "guard"),
    supervisors: profiles.filter((p) => p.role === "supervisor"),
    shifts: (shiftsRes.data || []).map(shiftFromRow),
    availability: availabilityFromRows(availRes.data),
    swapRequests: (swapsRes.data || []).map(swapFromRow),
    tasks: (tasksRes.data || []).map(taskFromRow),
  };
}

// ---------- shifts ----------

export async function createShifts(shifts, teamCode) {
  const { data, error } = await supabase
    .from("gs_shifts")
    .insert(shifts.map((s) => shiftToRow(s, teamCode)))
    .select("*, gs_assignments(guard_id, source, score, reason)");
  if (error) throw new Error(error.message);
  return (data || []).map(shiftFromRow);
}

export async function updateShift(shiftId, patch, teamCode) {
  const row = shiftToRow(patch, teamCode);
  delete row.id;
  delete row.team_code;
  const { data, error } = await supabase
    .from("gs_shifts").update(row).eq("id", shiftId)
    .select("*, gs_assignments(guard_id, source, score, reason)").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? shiftFromRow(data) : null;
}

export async function deleteShift(shiftId) {
  const { error } = await supabase.from("gs_shifts").delete().eq("id", shiftId);
  if (error) throw new Error(error.message);
}

export async function setPublished(shiftIds, published) {
  if (!shiftIds.length) return;
  const { error } = await supabase.from("gs_shifts").update({ published }).in("id", shiftIds);
  if (error) throw new Error(error.message);
}

// ---------- assignments ----------

export async function assignGuard({ shiftId, guardId, source = "manual", score = null, reason = null }) {
  const { error } = await supabase
    .from("gs_assignments")
    .upsert({ shift_id: shiftId, guard_id: guardId, source, score, reason }, { onConflict: "shift_id,guard_id" });
  if (error) throw new Error(error.message);
}

export async function unassignGuard({ shiftId, guardId }) {
  const { error } = await supabase
    .from("gs_assignments").delete().match({ shift_id: shiftId, guard_id: guardId });
  if (error) throw new Error(error.message);
}

/** Replace every auto-generated assignment for these shifts with a new plan. */
export async function applyPlan({ shiftIds, assignments }) {
  if (shiftIds.length) {
    const { error } = await supabase
      .from("gs_assignments").delete().in("shift_id", shiftIds).eq("source", "auto");
    if (error) throw new Error(error.message);
  }
  const rows = assignments
    .filter((a) => !a.locked)
    .map((a) => ({
      shift_id: a.shiftId,
      guard_id: a.guardId,
      source: "auto",
      score: a.score,
      reason: (a.parts || []).filter((p) => p.points > 0).map((p) => p.label).slice(0, 3).join(" · "),
    }));
  if (!rows.length) return;
  const { error } = await supabase
    .from("gs_assignments").upsert(rows, { onConflict: "shift_id,guard_id" });
  if (error) throw new Error(error.message);
}

export async function clearAssignments(shiftIds) {
  if (!shiftIds.length) return;
  const { error } = await supabase.from("gs_assignments").delete().in("shift_id", shiftIds);
  if (error) throw new Error(error.message);
}

// ---------- availability ----------

export async function setAvailability({ shiftId, guardId, status, comment }) {
  const { error } = await supabase.from("gs_availability").upsert(
    { shift_id: shiftId, guard_id: guardId, status, comment: comment || null, updated_at: new Date().toISOString() },
    { onConflict: "shift_id,guard_id" }
  );
  if (error) throw new Error(error.message);
}

// ---------- guards ----------

export async function addGuard({ name, phone, teamCode }) {
  const { data, error } = await supabase
    .from("gs_profiles")
    .insert({ full_name: name.trim(), phone: phone?.trim() || null, role: "guard", team_code: teamCode })
    .select().single();
  if (error) {
    // One guard per name per team is enforced by a unique index — that is what
    // stops a returning guard being duplicated. The cost is that two real
    // people who share a name need distinguishing, and Postgres explains that
    // in English constraint-speak. Say it in the user's language instead.
    if (error.code === "23505") {
      throw coded(
        "DUPLICATE_NAME",
        `כבר יש בצוות שומר בשם "${name.trim()}". הוסף משהו שיבדיל ביניהם — למשל שם משפחה או ראשי תיבות`
      );
    }
    throw new Error(error.message);
  }
  return profileFromRow(data);
}

export async function removeGuard(profileId) {
  const { error } = await supabase.from("gs_profiles").delete().eq("id", profileId);
  if (error) throw new Error(error.message);
}

// ---------- swaps ----------

export async function createSwap({ teamCode, shiftId, fromGuard, toGuard, message }) {
  const { data, error } = await supabase.from("gs_swap_requests")
    .insert({ team_code: teamCode, shift_id: shiftId, from_guard: fromGuard, to_guard: toGuard, message })
    .select().single();
  if (error) throw new Error(error.message);
  return swapFromRow(data);
}

export async function decideSwap(id, status) {
  const { error } = await supabase.from("gs_swap_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- tasks ----------

export async function createTask(task, teamCode) {
  const { data, error } = await supabase.from("gs_tasks").insert({
    team_code: teamCode, title: task.title, description: task.description || null,
    assigned_to: task.assignedTo || null, priority: task.priority || "medium",
    due_date: task.dueDate || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return taskFromRow(data);
}

export async function updateTask(id, patch) {
  const row = {};
  if (patch.status) row.status = patch.status;
  if (patch.title) row.title = patch.title;
  const { error } = await supabase.from("gs_tasks").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id) {
  const { error } = await supabase.from("gs_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
