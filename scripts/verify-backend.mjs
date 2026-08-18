// End-to-end check of the Supabase backend: auth, RPCs and row-level security.
//   node scripts/verify-backend.mjs
//
// Creates a throwaway supervisor + two guards, walks the real product flow,
// and asserts that RLS actually stops a guard from doing supervisor things.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL || "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const fresh = () => createClient(URL, KEY, opts);

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};
const stamp = Date.now();

// ---------- 1. supervisor signs up ----------
console.log("\n=== supervisor registration ===");
const sup = fresh();
const supEmail = `omer.sup.${stamp}@mailinator.com`;
const { data: supAuth, error: supErr } = await sup.auth.signUp({
  email: supEmail,
  password: "Guardian!2345",
});
check("signUp succeeds", !supErr, supErr?.message);
check("session returned immediately (no email confirmation)", Boolean(supAuth?.session));
if (!supAuth?.session) {
  console.log("\nFAIL — cannot continue without a session\n");
  process.exit(1);
}

const { data: teamRows, error: teamErr } = await sup.rpc("gs_create_team", {
  p_team_name: "מוקד בדיקה",
  p_full_name: "עומר האחמ\"ש",
});
check("gs_create_team succeeds", !teamErr, teamErr?.message);
const team = Array.isArray(teamRows) ? teamRows[0] : teamRows;
check("team code generated", /^[A-Z0-9]{6}$/.test(team?.team_code || ""), team?.team_code);
const CODE = team?.team_code;
console.log(`  team code: ${CODE}`);

// idempotency — calling twice must not create a second team
const { data: again } = await sup.rpc("gs_create_team", { p_team_name: "x", p_full_name: "y" });
check("gs_create_team is idempotent", (Array.isArray(again) ? again[0] : again)?.team_code === CODE);

// ---------- 2. supervisor builds a week ----------
console.log("\n=== supervisor creates shifts ===");
const today = new Date();
const iso = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftRows = [
  { team_code: CODE, date: iso(1), label: "משמרת יום",  start_time: "07:00", end_time: "19:00", type: "morning", color: "#3B82F6" },
  { team_code: CODE, date: iso(1), label: "משמרת לילה", start_time: "19:00", end_time: "07:00", type: "night",   color: "#6366F1" },
  { team_code: CODE, date: iso(2), label: "משמרת יום",  start_time: "07:00", end_time: "19:00", type: "morning", color: "#3B82F6" },
];
const { data: shifts, error: shiftErr } = await sup.from("gs_shifts").insert(shiftRows).select();
check("supervisor can insert shifts", !shiftErr && shifts?.length === 3, shiftErr?.message);

// ---------- 3. guards join anonymously ----------
console.log("\n=== guards join with the team code ===");
const guardA = fresh();
const { data: anonA, error: anonErrA } = await guardA.auth.signInAnonymously();
check("anonymous sign-in works", !anonErrA && Boolean(anonA?.session), anonErrA?.message);

const { data: joinA, error: joinErrA } = await guardA.rpc("gs_join_team", {
  p_code: CODE.toLowerCase(), // case-insensitive on purpose
  p_full_name: "גיא לוי",
});
check("gs_join_team succeeds (case-insensitive)", !joinErrA, joinErrA?.message);
const profA = Array.isArray(joinA) ? joinA[0] : joinA;
check("guard profile created", Boolean(profA?.profile_id));

const guardB = fresh();
await guardB.auth.signInAnonymously();
const { data: joinB } = await guardB.rpc("gs_join_team", { p_code: CODE, p_full_name: "מיכל כהן" });
const profB = Array.isArray(joinB) ? joinB[0] : joinB;
check("second guard joins", Boolean(profB?.profile_id));

// bad code must be rejected
const guardBad = fresh();
await guardBad.auth.signInAnonymously();
const { error: badErr } = await guardBad.rpc("gs_join_team", { p_code: "ZZZZZZ", p_full_name: "רפאים" });
check("unknown team code rejected", Boolean(badErr) && /TEAM_NOT_FOUND/.test(badErr?.message || ""), badErr?.message);

// ---------- 4. RLS visibility ----------
console.log("\n=== row-level security ===");
const { data: guardShifts } = await guardA.from("gs_shifts").select("*");
check("guard sees their team's shifts", guardShifts?.length === 3, `saw ${guardShifts?.length}`);

const { data: guardProfiles } = await guardA.from("gs_profiles").select("*");
check("guard sees teammates", guardProfiles?.length === 3, `saw ${guardProfiles?.length}`);

// an outsider must see nothing
const outsider = fresh();
await outsider.auth.signInAnonymously();
const { data: outsiderShifts } = await outsider.from("gs_shifts").select("*");
check("outsider sees no shifts", (outsiderShifts?.length || 0) === 0, `saw ${outsiderShifts?.length}`);

// guards must not be able to create or publish shifts
const { error: guardWriteErr } = await guardA.from("gs_shifts").insert({
  team_code: CODE, date: iso(3), label: "פיראטית", start_time: "07:00", end_time: "19:00",
});
check("guard cannot create shifts", Boolean(guardWriteErr), "insert unexpectedly allowed");

const { data: pubData } = await guardA.from("gs_shifts")
  .update({ published: true }).eq("id", shifts[0].id).select();
check("guard cannot publish shifts", (pubData?.length || 0) === 0);

// ---------- 5. availability ----------
console.log("\n=== availability ===");
const { error: availErr } = await guardA.from("gs_availability").upsert({
  shift_id: shifts[0].id, guard_id: profA.profile_id, status: "available", comment: "מוכן",
});
check("guard writes own availability", !availErr, availErr?.message);

const { error: spoofErr } = await guardA.from("gs_availability").upsert({
  shift_id: shifts[1].id, guard_id: profB.profile_id, status: "unavailable",
});
check("guard cannot write someone else's availability", Boolean(spoofErr), "spoof unexpectedly allowed");

await guardB.from("gs_availability").upsert({
  shift_id: shifts[0].id, guard_id: profB.profile_id, status: "unavailable", comment: "מילואים",
});

const { data: supAvail } = await sup.from("gs_availability").select("*");
check("supervisor sees all submitted availability", supAvail?.length === 2, `saw ${supAvail?.length}`);
check("comments arrive intact", supAvail?.some((a) => a.comment === "מילואים"));

// ---------- 6. assignments + publishing ----------
console.log("\n=== assignment and publishing ===");
const { error: assignErr } = await sup.from("gs_assignments").insert({
  shift_id: shifts[0].id, guard_id: profA.profile_id, source: "auto", score: 87.5,
  reason: "סימן זמין · עומס נמוך",
});
check("supervisor assigns a guard", !assignErr, assignErr?.message);

await sup.from("gs_shifts").update({ published: true }).eq("id", shifts[0].id);

const { data: seen } = await guardA.from("gs_shifts")
  .select("*, gs_assignments(guard_id, reason, score)").eq("published", true);
check("guard sees the published shift with its assignment", seen?.[0]?.gs_assignments?.length === 1);
check("assignment reasoning is readable by the guard", seen?.[0]?.gs_assignments?.[0]?.reason?.length > 0);

// ---------- 7. supervisor signs back in from a 'new device' ----------
console.log("\n=== supervisor logs in from another device ===");
const device2 = fresh();
const { data: reAuth, error: reErr } = await device2.auth.signInWithPassword({
  email: supEmail, password: "Guardian!2345",
});
check("password sign-in works", !reErr && Boolean(reAuth?.session), reErr?.message);
const { data: myTeam } = await device2.rpc("gs_my_team");
check("same team code on the new device", myTeam === CODE, `got ${myTeam}`);
const { data: d2shifts } = await device2.from("gs_shifts").select("*");
check("shifts are there on the new device", d2shifts?.length === 3, `saw ${d2shifts?.length}`);

// ---------- 8. returning guard keeps their identity ----------
console.log("\n=== returning guard ===");
const { data: rejoin } = await guardA.rpc("gs_join_team", { p_code: CODE, p_full_name: "גיא לוי" });
check("re-joining on the same session returns the same profile",
  (Array.isArray(rejoin) ? rejoin[0] : rejoin)?.profile_id === profA.profile_id);

// The case that actually broke in production. A guard's session is anonymous:
// clear browser data, switch phone, or let the token lapse, and
// signInAnonymously() mints a brand-new auth uid. The old function looked the
// person up by uid, found nothing, and inserted a second profile — so the
// roster grew a duplicate on every single visit, splitting their assignments
// and availability across copies.
const guardAgain = fresh();
await guardAgain.auth.signInAnonymously();
const { data: readopt, error: readoptErr } = await guardAgain.rpc("gs_join_team", {
  p_code: CODE, p_full_name: "גיא לוי",
});
check("re-joining from a NEW anonymous session adopts the existing profile",
  (Array.isArray(readopt) ? readopt[0] : readopt)?.profile_id === profA.profile_id,
  readoptErr?.message || `got ${(Array.isArray(readopt) ? readopt[0] : readopt)?.profile_id}`);

const { data: rosterNow } = await sup.from("gs_profiles").select("id, full_name").eq("team_code", CODE);
const guyCopies = (rosterNow || []).filter((p) => p.full_name === "גיא לוי").length;
check("the roster still shows one גיא לוי, not two", guyCopies === 1, `${guyCopies} copies`);
check("no phantom guards appeared at all", (rosterNow?.length || 0) === 3, `roster is ${rosterNow?.length}`);

// Names differing only by surrounding whitespace or case are the same person.
const guardSloppy = fresh();
await guardSloppy.auth.signInAnonymously();
const { data: sloppy } = await guardSloppy.rpc("gs_join_team", {
  p_code: CODE, p_full_name: "  גיא לוי  ",
});
check("whitespace around the name does not create a duplicate",
  (Array.isArray(sloppy) ? sloppy[0] : sloppy)?.profile_id === profA.profile_id);

const { error: blankErr } = await guardSloppy.rpc("gs_join_team", { p_code: CODE, p_full_name: "   " });
check("a blank name is rejected rather than creating an unnamed guard",
  Boolean(blankErr) && /NAME_REQUIRED/.test(blankErr?.message || ""), blankErr?.message);

// ---------- 9. the "preferred" tier ----------
console.log("\n=== preferences ===");
const { error: prefErr } = await guardA.from("gs_availability").upsert({
  shift_id: shifts[1].id, guard_id: profA.profile_id, status: "preferred",
  comment: "מעדיף דווקא את זו",
});
check("guard can record a preference", !prefErr, prefErr?.message);

const { data: prefSeen } = await sup.from("gs_availability")
  .select("status, comment").eq("guard_id", profA.profile_id).eq("shift_id", shifts[1].id).maybeSingle();
check("supervisor reads the preference back", prefSeen?.status === "preferred", prefSeen?.status);

const { error: junkErr } = await guardA.from("gs_availability").upsert({
  shift_id: shifts[2].id, guard_id: profA.profile_id, status: "whatever",
});
check("an unknown status is still rejected by the constraint", Boolean(junkErr));

// ---------- cleanup ----------
await sup.from("gs_teams").delete().eq("code", CODE);
const { data: leftovers } = await sup.from("gs_shifts").select("id");
check("cascade delete cleans the team up", (leftovers?.length || 0) === 0);

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
