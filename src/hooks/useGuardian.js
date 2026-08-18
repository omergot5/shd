// ============================================================
// The app's single source of truth.
//
// Holds the session, the signed-in profile and the whole team dataset, and
// exposes actions that write to Supabase and then patch local state, so the
// UI stays responsive without a full refetch after every click.
//
// Three rules this file enforces, because getting any of them wrong shows up
// as a silent lie on screen:
//   1. Every action reports its failure. An awaited promise that rejects with
//      nobody listening is an error the user never learns about.
//   2. Every optimistic update can be rolled back. Painting a change before
//      the server agrees is fine; leaving it painted after the server refuses
//      is not.
//   3. `actions` is referentially stable. It is passed to every screen, so if
//      its identity changed with the data, memoised children would all
//      re-render on every keystroke.
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

  // Mirror of `data` for async callbacks. Reading state straight out of a
  // closure gives you whatever it was when the callback was created; this is
  // always the last committed value.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // StrictMode mounts, unmounts and remounts in dev. The flag has to be raised
  // again on every mount, or the cleanup from the first pass leaves it false
  // and every setState below is silently skipped.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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

  useEffect(() => {
    boot();
  }, [boot]);

  const refresh = useCallback(async () => {
    const teamCode = dataRef.current.team?.code;
    if (!teamCode) return;
    try {
      const team = await api.loadTeam(teamCode);
      if (mounted.current) setData(team);
    } catch (e) {
      if (mounted.current) setError(e.message);
    }
  }, []);

  // ---------- live updates ----------
  // Everyone on a team shares one channel; any write nudges the others to
  // refetch. RLS already limits which rows reach this client, so no filter is
  // needed here — a change you are not allowed to see never arrives.
  const teamCode = user?.teamCode;
  useEffect(() => {
    if (!teamCode) return;
    const onChange = () => refresh();
    const channel = supabase.channel(`team-${teamCode}`);
    for (const table of [
      "gs_shifts", "gs_assignments", "gs_availability", "gs_profiles", "gs_swap_requests",
    ]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamCode, refresh]);

  // ---------- action plumbing ----------

  /**
   * Runs an async action with a busy flag and centralised error reporting.
   *
   * @param rethrow  auth screens render their own inline message and need the
   *                 original error (they branch on `e.code`), so they opt in.
   *                 Data actions are fire-and-forget from the UI's point of
   *                 view and must not produce an unhandled rejection.
   */
  const run = useCallback(async (fn, { rethrow = false } = {}) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      if (mounted.current) setError(e.message || "הפעולה נכשלה — נסה שוב");
      if (rethrow) throw e;
      return undefined;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  /**
   * Paints `patch` immediately, then does the real write. If the write fails
   * the previous dataset is restored, so the screen never keeps showing a
   * change the server rejected.
   */
  const optimistic = useCallback(
    (patch, work) =>
      run(async () => {
        const snapshot = dataRef.current;
        setData(patch);
        try {
          await work();
        } catch (e) {
          if (mounted.current) setData(snapshot);
          throw e;
        }
      }),
    [run]
  );

  // ---------- auth actions ----------

  const register = useCallback(
    (form) =>
      run(
        async () => {
          const { teamCode: code } = await api.registerSupervisor(form);
          await hydrate(await api.getMyProfile());
          return code;
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  const login = useCallback(
    (form) =>
      run(
        async () => {
          const profile = await api.loginSupervisor(form);
          await hydrate(profile);
          return profile;
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  const joinTeam = useCallback(
    (form) =>
      run(
        async () => {
          const profile = await api.joinAsGuard(form);
          await hydrate(profile);
          return profile;
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  /** Guest entry: an anonymous supervisor with a fully seeded demo team. */
  const startGuestDemo = useCallback(
    () =>
      run(
        async () => {
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
          await hydrate(await api.getMyProfile());
          return row.team_code;
        },
        { rethrow: true }
      ),
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
  //
  // Deliberately depends only on stable callbacks, never on `data` — the
  // current dataset is read through `dataRef` at call time instead. That
  // keeps this object identical across renders.

  const actions = useMemo(
    () => ({
      seedDemo: () =>
        run(async () => {
          const { team, guards, shifts } = dataRef.current;
          const res = await seedDemoTeam({
            teamCode: team?.code,
            existingGuards: guards,
            existingShifts: shifts,
          });
          await refresh();
          return res;
        }),

      addShifts: (shifts) =>
        run(async () => {
          await api.createShifts(shifts, dataRef.current.team?.code);
          await refresh();
        }),

      updateShift: (id, patch) =>
        run(async () => {
          await api.updateShift(id, patch, dataRef.current.team?.code);
          await refresh();
        }),

      deleteShift: (id) =>
        optimistic(
          (d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) }),
          () => api.deleteShift(id)
        ),

      publish: (shiftIds, published) =>
        optimistic(
          (d) => ({
            ...d,
            shifts: d.shifts.map((s) => (shiftIds.includes(s.id) ? { ...s, published } : s)),
          }),
          () => api.setPublished(shiftIds, published)
        ),

      toggleAssignment: (shiftId, guardId) => {
        const shift = dataRef.current.shifts.find((s) => s.id === shiftId);
        const assigned = Boolean(shift?.assignedGuards.includes(guardId));
        return optimistic(
          (d) => ({
            ...d,
            shifts: d.shifts.map((s) =>
              s.id !== shiftId
                ? s
                : {
                    ...s,
                    assignedGuards: assigned
                      ? s.assignedGuards.filter((g) => g !== guardId)
                      : [...s.assignedGuards, guardId],
                  }
            ),
          }),
          () =>
            assigned
              ? api.unassignGuard({ shiftId, guardId })
              : api.assignGuard({ shiftId, guardId, source: "manual" })
        );
      },

      applyPlan: (shiftIds, assignments) =>
        run(async () => {
          await api.applyPlan({ shiftIds, assignments });
          await refresh();
        }),

      clearAssignments: (shiftIds) =>
        run(async () => {
          await api.clearAssignments(shiftIds);
          await refresh();
        }),

      setAvailability: (shiftId, guardId, status, comment) =>
        optimistic(
          (d) => ({
            ...d,
            availability: {
              ...d.availability,
              [`${guardId}-${shiftId}`]: { status, comment: comment || "" },
            },
          }),
          () => api.setAvailability({ shiftId, guardId, status, comment })
        ),

      addGuard: (name, phone) =>
        run(async () => {
          await api.addGuard({ name, phone, teamCode: dataRef.current.team?.code });
          await refresh();
        }),

      removeGuard: (id) =>
        optimistic(
          (d) => ({ ...d, guards: d.guards.filter((g) => g.id !== id) }),
          () => api.removeGuard(id)
        ),

      createSwap: (payload) =>
        run(async () => {
          await api.createSwap({ ...payload, teamCode: dataRef.current.team?.code });
          await refresh();
        }),

      decideSwap: (id, status) =>
        optimistic(
          (d) => ({
            ...d,
            swapRequests: d.swapRequests.map((r) => (r.id === id ? { ...r, status } : r)),
          }),
          () => api.decideSwap(id, status)
        ),

      createTask: (task) =>
        run(async () => {
          await api.createTask(task, dataRef.current.team?.code);
          await refresh();
        }),

      toggleTask: (id, status) =>
        optimistic(
          (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }),
          () => api.updateTask(id, { status })
        ),

      deleteTask: (id) =>
        optimistic(
          (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }),
          () => api.deleteTask(id)
        ),
    }),
    [run, optimistic, refresh]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    error,
    busy,
    ...data,
    register,
    login,
    joinTeam,
    startGuestDemo,
    logout,
    refresh,
    actions,
    clearError,
  };
}
