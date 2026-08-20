import { useMemo, useState } from "react";
import { Badge, Btn, Card, EmptyState, IconBtn, PageHeader, guardColor, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { t } from "../../lib/terms.js";
import {
  DAYS_HE, DAYS_HE_SHORT, addDays, dayName, formatDateHe, fromISODate, monthGrid, monthLabelHe,
  rangeLabelHe, shiftHours, startOfWeek, toISODate, todayISO, weekFrom,
} from "../../lib/dates.js";

// ============================================================
// CALENDAR
//
// One dataset, three zoom levels. A month to see the shape of the roster and
// spot the empty days, a week to work in, a day to check who is actually on.
// The mode never changes what the data means — only how far back you stand.
// ============================================================

const MODES = [
  { id: "month", label: "חודש", icon: "grid" },
  { id: "week", label: "שבוע", icon: "calendar" },
  { id: "day", label: "יום", icon: "clock" },
];

/** Compact coverage state — the one thing worth seeing from a month away. */
const coverageOf = (dayShifts) => {
  if (!dayShifts.length) return null;
  const need = dayShifts.reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
  const got = dayShifts.reduce((n, s) => n + s.assignedGuards.length, 0);
  return { need, got, full: got >= need, empty: got === 0 };
};

export default function CalendarView({ shifts, guards, onNavigate }) {
  const today = todayISO();
  const [mode, setMode] = useState("month");
  const [cursor, setCursor] = useState(today); // any date inside the shown range

  const byDate = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(s);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [shifts]);

  const cur = fromISODate(cursor);
  const dates =
    mode === "month"
      ? monthGrid(cur.getFullYear(), cur.getMonth())
      : mode === "week"
      ? weekFrom(startOfWeek(cursor))
      : [cursor];

  const step = (dir) => {
    if (mode === "month") {
      const d = new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
      setCursor(toISODate(d));
    } else {
      setCursor(addDays(cursor, dir * (mode === "week" ? 7 : 1)));
    }
  };

  const title =
    mode === "month"
      ? monthLabelHe(cur.getFullYear(), cur.getMonth())
      : mode === "week"
      ? rangeLabelHe(dates)
      : formatDateHe(cursor);

  const shown = dates.flatMap((d) => byDate.get(d) || []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="יומן"
        subtitle={`${shown.length} משמרות בתצוגה`}
        actions={
          <div
            role="radiogroup"
            aria-label="רזולוציית תצוגה"
            className="inline-flex items-center gap-0.5 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline p-1"
          >
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.id)}
                  className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5
                    cursor-pointer transition-colors duration-200 ${
                      on ? "bg-brand text-on-brand" : "text-muted hover:text-content"
                    }`}
                >
                  <Icon name={m.icon} size={14} />
                  {m.label}
                </button>
              );
            })}
          </div>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          {/* Chevrons point the way the calendar moves, which in RTL is the
              mirror of the LTR habit: "next" sits on the left. */}
          <IconBtn icon="right" size="sm" label="הקודם" onClick={() => step(-1)} />
          <div className="text-center min-w-0">
            <h2 className="font-bold text-content text-sm sm:text-base truncate">{title}</h2>
            {cursor !== today && (
              <button
                onClick={() => setCursor(today)}
                className="text-[11px] text-brand hover:underline cursor-pointer"
              >
                חזור להיום
              </button>
            )}
          </div>
          <IconBtn icon="left" size="sm" label="הבא" onClick={() => step(1)} />
        </div>

        {mode === "month" && (
          <MonthGrid
            dates={dates}
            month={cur.getMonth()}
            byDate={byDate}
            today={today}
            onPick={(d) => {
              setCursor(d);
              setMode("day");
            }}
          />
        )}

        {mode === "week" && (
          <WeekStrip dates={dates} byDate={byDate} guards={guards} today={today}
            onPick={(d) => { setCursor(d); setMode("day"); }} />
        )}

        {mode === "day" && <DayList date={cursor} shifts={byDate.get(cursor) || []} guards={guards} />}
      </Card>

      {shown.length === 0 && mode !== "day" && (
        <EmptyState
          icon="calendar"
          title="אין משמרות בתצוגה הזו"
          body={`נווט לתקופה אחרת, או צור משמרות במסך "${t("nav.shifts")}".`}
          action={
            onNavigate && (
              <Btn icon="plus" onClick={() => onNavigate("shifts")}>
                {t("nav.shifts")}
              </Btn>
            )
          }
        />
      )}
    </div>
  );
}

function MonthGrid({ dates, month, byDate, today, onPick }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_HE.map((d, i) => (
          <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-muted py-1">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DAYS_HE_SHORT[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const dayShifts = byDate.get(date) || [];
          const cov = coverageOf(dayShifts);
          const inMonth = fromISODate(date).getMonth() === month;
          const isToday = date === today;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              aria-label={`${formatDateHe(date)} — ${dayShifts.length} משמרות`}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-0.5
                ring-1 ring-inset cursor-pointer transition-colors duration-200 min-h-[44px]
                ${isToday ? "ring-brand ring-2 bg-brand/10" : "ring-hairline hover:ring-brand/40 hover:bg-surface-hover"}
                ${inMonth ? "" : "opacity-35"}`}
            >
              <span
                className={`text-[11px] sm:text-xs font-bold ${isToday ? "text-brand" : "text-content"}`}
                data-numeric
              >
                {fromISODate(date).getDate()}
              </span>
              {/* Dots, capped at four, plus a count — a month cell that tries
                  to list shifts becomes unreadable at phone width. */}
              {dayShifts.length > 0 && (
                <div className="flex flex-wrap gap-[2px] justify-center leading-none">
                  {dayShifts.slice(0, 4).map((s) => (
                    <span
                      key={s.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: s.color }}
                    />
                  ))}
                </div>
              )}
              {cov && (
                <span
                  className={`text-[9px] font-bold mt-auto ${
                    cov.empty ? "text-danger" : cov.full ? "text-accent" : "text-warn"
                  }`}
                  data-numeric
                >
                  {cov.got}/{cov.need}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-hairline text-[11px] text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <Icon name="check-circle" size={12} className="text-accent" /> מאויש במלואו
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="alert" size={12} className="text-warn" /> חלקי
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="x-circle" size={12} className="text-danger" /> ריק
        </span>
      </div>
    </div>
  );
}

function WeekStrip({ dates, byDate, guards, today, onPick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {dates.map((date) => {
        const dayShifts = byDate.get(date) || [];
        const isToday = date === today;
        return (
          <div key={date}>
            <button
              onClick={() => onPick(date)}
              className={`w-full text-center mb-2 pb-1.5 border-b-2 cursor-pointer ${
                isToday ? "border-brand" : "border-hairline hover:border-brand/40"
              }`}
            >
              <p className={`text-[11px] ${isToday ? "text-brand font-bold" : "text-muted"}`}>
                {dayName(date)}
              </p>
              <p className={`text-sm font-bold ${isToday ? "text-brand" : "text-content"}`} data-numeric>
                {fromISODate(date).getDate()}
              </p>
            </button>
            <div className="space-y-1.5">
              {dayShifts.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg p-2 text-[11px]"
                  style={{ background: s.color, color: readableInk(s.color) }}
                >
                  <div className="font-bold truncate">{s.label}</div>
                  <div className="opacity-90 text-[10px]" data-numeric>
                    {s.startTime}–{s.endTime}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.assignedGuards.map((gid) => {
                      const g = guards.find((x) => x.id === gid);
                      if (!g) return null;
                      const c = guardColor(gid);
                      return (
                        <span
                          key={gid}
                          className="px-1 py-0.5 rounded text-[9px] font-bold"
                          style={{ background: c, color: readableInk(c) }}
                        >
                          {g.name.split(" ")[0]}
                        </span>
                      );
                    })}
                    {s.assignedGuards.length === 0 && (
                      <span className="bg-black/25 text-white px-1 py-0.5 rounded text-[9px]">
                        לא משובץ
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {dayShifts.length === 0 && (
                <p className="text-center text-[11px] text-faint py-3">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({ date, shifts, guards }) {
  if (!shifts.length) {
    return (
      <EmptyState
        icon="calendar"
        title={`אין משמרות ב${formatDateHe(date)}`}
        body="אפשר להוסיף משמרות במסך ניהול המשמרות."
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {shifts.map((s) => {
        const short = s.assignedGuards.length < s.requiredGuards;
        return (
          <div
            key={s.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline"
          >
            <div
              className="w-1.5 self-stretch rounded-full flex-shrink-0"
              style={{ background: s.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-content text-sm">{s.label}</span>
                <span className="text-xs text-muted" data-numeric>
                  {s.startTime}–{s.endTime} · {shiftHours(s)} ש'
                </span>
                {s.published ? (
                  <Badge tone="accent" icon="check">פורסם</Badge>
                ) : (
                  <Badge tone="neutral">טיוטה</Badge>
                )}
                {short && (
                  <Badge tone="danger" icon="alert">
                    חסרים {s.requiredGuards - s.assignedGuards.length}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-faint mt-0.5 flex items-center gap-1">
                <Icon name="map-pin" size={11} />
                {s.location}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {s.assignedGuards.map((gid) => {
                  const g = guards.find((x) => x.id === gid);
                  if (!g) return null;
                  const c = guardColor(gid);
                  return (
                    <span
                      key={gid}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                      style={{ background: c, color: readableInk(c) }}
                    >
                      {g.name}
                    </span>
                  );
                })}
                {s.assignedGuards.length === 0 && (
                  <span className="text-[11px] text-danger font-medium">לא שובץ אף אחד</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
