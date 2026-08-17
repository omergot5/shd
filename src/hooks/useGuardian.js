// ============================================================
// The app's single source of truth.
//
// Holds the session, the signed-in profile and the whole team dataset, and
// exposes actions that write to Supabase and then patch local state, so the UI
// stays responsive without a full refetch after every click.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import * as api from "../lib/api.js";
import { seedDemoTeam } from "../lib/demoData.js";

const EMPTY = {
  team: null,
  members: [],
  guards: [],
  supervisors: [],
  shifts: [],
  availability: {},
  swapRequests: [],
  tasks: [],
};

export function useGuardian() {
  const [status, setStatus] = useState("booting"); // booting | anonymous | ready | error
  const [user, setUser] = useState(null); // the app profile, not the auth user
  const [data, setData] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  // StrictMode mounts, unmounts and remounts in dev. The flag has to be raised
  // again on every mount, or the cleanup from the first pass leaves it false
  // and every setState below is silently skipped.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // ---------- bootstrap ----------

  const hydrate = useCallback(async (profile) => {
    const team = await api.loadTeam(profile.teamCode);
    if (!mounted.current) return;
    setData(team);
    setUser(profile);
    setStatus("ready");
  }, []);

  const boot = useCallback(async () => {
    try {
      const profile = await api.getMyProfile();
      if (!mounted.current) return;
      if (!profile) {
        setStatus("anonymous");
        return;
      }
      await hydrate(profile);
    } catch (e) {
      if (!mounted.current) return;
      setError(e.message || "לא הצלחנו לטעון את הנתונים");
      setStatus("error");
    }
  }, [hydrate]);

  useEffect(() => { boot(); }, [boot]);

  const refresh = useCallback(async () => {
    if (!user?.teamCode) return;
    try {
      const team = await api.loadTeam(user.teamCode);
      if (mounted.current) setData(team);
    } catch (e) {
      if (mounted.current) setError(e.message);
    }
  }, [user?.teamCode]);

  // ---------- live updates ----------
  // Everyone on a team shares one channel; any write nudges the others to
  // refetch. Simple, and it makes a two-device demo feel alive.
  useEffect(() => {
    if (!user?.teamCode) return;
    const channel = supabase
      .channel(`team-${user.teamCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gs_shifts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "gs_assignments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "gs_availability" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "gs_profiles" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "gs_swap_requests" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.teamCode, refresh]);

  // ---------- auth actions ----------

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  const register = useCallback(
    (form) => run(async () => {
      const { teamCode } = await api.registerSupervisor(form);
      const profile = await api.getMyProfile();
      await hydrate(profile);
      return teamCode;
    }),
    [run, hydrate]
  );

  const login = useCallback(
    (form) => run(async () => {
      const profile = await api.loginSupervisor(form);
      await hydrate(profile);
      return profile;
    }),
    [run, hydrate]
  );

  const joinTeam = useCallback(
    (form) => run(async () => {
      const profile = await api.joinAsGuard(form);
      await hydrate(profile);
      return profile;
    }),
    [run, hydrate]
  );

  /** Guest entry: an anonymous supervisor with a fully seeded demo team. */
  const startGuestDemo = useCallback(
    () => run(async () => {
      const session = await api.getSession();
      if (!session) {
        const { error: e } = await supabase.auth.signInAnonymously();
        if (e) throw new Error("לא הצלחנו לפתוח הדגמה — בדוק את החיבור לאינטרנט");
      }
      const { data: rows, error: rpcErr } = await supabase.rpc("gs_create_team", {
        p_team_name: "מוקד הדגמה",
        p_full_name: "מנהל הדגמה",
      });
      if (rpcErr) throw new Error("פתיחת ההדגמה נכשלה — נסה שוב");
      const row = Array.isArray(rows) ? rows[0] : rows;

      await seedDemoTeam({ teamCode: row.team_code, existingGuards: [], existingShifts: [] });
      const profile = await api.getMyProfile();
      await hydrate(profile);
      return row.team_code;
    }),
    [run, hydrate]
  );

  const logout = useCallback(async () => {
    await api.logout();
    if (!mounted.current) return;
    setUser(null);
    setData(EMPTY);
    setError(null);
    setStatus("anonymous");
  }, []);

  // ---------- data actions ----------

  const teamCode = user?.teamCode;

  const actions = useMemo(() => ({
    seedDemo: () => run(async () => {
      const res = await seedDemoTeam({
        teamCode, existingGuards: data.guards, existingShifts: data.shifts,
      });
      await refresh();
      return res;
    }),

    addShifts: (shifts) => run(async () => {
      await api.createShifts(shifts, teamCode);
      await refresh();
    }),

    updateShift: (id, patch) => run(async () => {
      await api.updateShift(id, patch, teamCode);
      await refresh();
    }),

    deleteShift: (id) => run(async () => {
      setData((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) }));
      await api.deleteShift(id);
    }),

    publish: (shiftIds, published) => run(async () => {
      setData((d) => ({
        ...d,
        shifts: d.shifts.map((s) => (shiftIds.includes(s.id) ? { ...s, published } : s)),
      }));
      await api.setPublished(shiftIds, published);
    }),

    toggleAssignment: (shiftId, guardId) => run(async () => {
      const shift = data.shifts.find((s) => s.id === shiftId);
      const assigned = shift?.assignedGuards.includes(guardId);
      setData((d) => ({
        ...d,
        shifts: d.shifts.map((s) =>
          s.id !== shiftId ? s : {
            ...s,
            assignedGuards: assigned
              ? s.assignedGuards.filter((g) => g !== guardId)
              : [...s.assignedGuards, guardId],
          }
        ),
      }));
      if (assigned) await api.unassignGuard({ shiftId, guardId });
      else await api.assignGuard({ shiftId, guardId, source: "manual" });
    }),

    applyPlan: (shiftIds, assignments) => run(async () => {
      await api.applyPlan({ shiftIds, assignments });
      await refresh();
    }),

    clearAssignments: (shiftIds) => run(async () => {
      await api.clearAssignments(shiftIds);
      await refresh();
    }),

    setAvailability: (shiftId, guardId, status, comment) => run(async () => {
      setData((d) => ({
        ...d,
        availability: { ...d.availability, [`${guardId}-${shiftId}`]: { status, comment: comment || "" } },
      }));
      await api.setAvailability({ shiftId, guardId, status, comment });
    }),

    addGuard: (name, phone) => run(async () => {
      await api.addGuard({ name, phone, teamCode });
      await refresh();
    }),

    removeGuard: (id) => run(async () => {
      setData((d) => ({ ...d, guards: d.guards.filter((g) => g.id !== id) }));
      await api.removeGuard(id);
      await refresh();
    }),

    createSwap: (payload) => run(async () => {
      await api.createSwap({ ...payload, teamCode });
      await refresh();
    }),

    decideSwap: (id, status) => run(async () => {
      setData((d) => ({
        ...d,
        swapRequests: d.swapRequests.map((r) => (r.id === id ? { ...r, status } : r)),
      }));
      await api.decideSwap(id, status);
    }),

    createTask: (task) => run(async () => {
      await api.createTask(task, teamCode);
      await refresh();
    }),

    toggleTask: (id, status) => run(async () => {
      setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }));
      await api.updateTask(id, { status });
    }),

    deleteTask: (id) => run(async () => {
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
      await api.deleteTask(id);
    }),
  }), [run, refresh, teamCode, data.guards, data.shifts]);

  return {
    status, user, error, busy,
    ...data,
    register, login, joinTeam, startGuestDemo, logout, refresh, actions,
    clearError: () => setError(null),
    setError,
  };
}
