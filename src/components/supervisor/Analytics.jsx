import { useMemo } from "react";
import { SHIFT_TONES } from "../../design/shiftPalette.js";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Avatar, Card, EmptyState, PageHeader } from "../ui.jsx";
import { useTheme } from "../../hooks/useTheme.js";
import { shiftHours } from "../../lib/dates.js";

// Kept in its own module and loaded lazily — recharts is roughly half the
// bundle, and reports are never the first screen a supervisor opens.

const SHIFT_TYPES = [
  { type: "morning", label: "בוקר/יום", color: SHIFT_TONES.morning },
  { type: "afternoon", label: "צהריים", color: SHIFT_TONES.afternoon },
  { type: "night", label: "לילה", color: SHIFT_TONES.night },
];

const TYPE_LABEL = Object.fromEntries(SHIFT_TYPES.map((t) => [t.type, t.label]));

export default function AnalyticsDash({ guards, shifts }) {
  // Recharts styles its axes and tooltips through JS props, not CSS, so it
  // cannot read our custom properties — it has to be told the theme.
  const { resolved } = useTheme();
  const axis = resolved === "light" ? "#475569" : "#94A3B8";
  const grid = resolved === "light" ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)";
  const tooltipStyle = {
    background: resolved === "light" ? "#FFFFFF" : "#131C2D",
    border: `1px solid ${grid}`,
    borderRadius: 12,
    color: resolved === "light" ? "#0F172A" : "#F1F5F9",
    fontSize: 12,
    direction: "rtl",
  };

  const stats = useMemo(
    () =>
      guards.map((g) => {
        const mine = shifts.filter((s) => s.assignedGuards.includes(g.id));
        return {
          name: g.name.split(" ")[0],
          fullName: g.name,
          id: g.id,
          total: mine.length,
          morning: mine.filter((s) => s.type === "morning").length,
          afternoon: mine.filter((s) => s.type === "afternoon").length,
          night: mine.filter((s) => s.type === "night").length,
          hours: Math.round(mine.reduce((n, s) => n + shiftHours(s), 0)),
        };
      }),
    [guards, shifts]
  );

  const typeStats = useMemo(
    () =>
      SHIFT_TYPES.map((d) => ({
        name: d.label,
        color: d.color,
        value: shifts
          .filter((s) => s.type === d.type)
          .reduce((n, s) => n + s.assignedGuards.length, 0),
      })).filter((d) => d.value > 0),
    [shifts]
  );

  const totalAssigned = shifts.reduce((n, s) => n + s.assignedGuards.length, 0);

  if (!guards.length || totalAssigned === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="דוחות" subtitle="סטטיסטיקות עומס ומעקב" />
        <EmptyState
          icon="trending"
          title="אין עדיין נתונים"
          body="אחרי שתשבץ משמרות, כאן יופיעו גרפי עומס והתפלגות."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="דוחות" subtitle={`${totalAssigned} שיבוצים · ${guards.length} שומרים`} />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-content mb-4">משמרות לפי שומר</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats} layout="vertical" margin={{ right: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
              <XAxis type="number" tick={{ fontSize: 11, fill: axis }} allowDecimals={false} stroke={grid} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11, fill: axis }} stroke={grid} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: grid }}
                formatter={(v, n) => [v, TYPE_LABEL[n] || n]}
              />
              <Bar dataKey="morning" stackId="a" fill={SHIFT_TONES.morning} />
              <Bar dataKey="afternoon" stackId="a" fill={SHIFT_TONES.afternoon} />
              <Bar dataKey="night" stackId="a" fill={SHIFT_TONES.night} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* An explicit legend: the stacked bars are distinguished only by
              colour, which is not enough on its own. */}
          <div className="flex gap-4 justify-center mt-2 text-xs text-muted flex-wrap">
            {SHIFT_TYPES.map((t) => (
              <span key={t.type} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: t.color }}
                  aria-hidden="true"
                />
                {t.label}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-content mb-4">התפלגות סוגי משמרות</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={typeStats}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
                stroke="none"
              >
                {typeStats.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h2 className="font-bold text-content mb-4">פירוט לפי שומר</h2>
        <table className="w-full text-sm min-w-[480px]">
          <caption className="sr-only">פירוט משמרות ושעות לכל שומר</caption>
          <thead>
            <tr className="border-b border-hairline">
              {["שומר", "בוקר/יום", "צהריים", "לילה", 'סה"כ', "שעות"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={`py-2 px-3 font-medium text-muted ${h === "שומר" ? "text-right" : "text-center"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="border-b border-hairline last:border-0">
                <th scope="row" className="py-2.5 px-3 text-right font-normal">
                  <div className="flex items-center gap-2">
                    <Avatar id={s.id} name={s.fullName} size={24} />
                    <span className="font-medium text-content text-xs">{s.fullName}</span>
                  </div>
                </th>
                <td className="py-2.5 px-3 text-center text-warn font-semibold">{s.morning}</td>
                <td className="py-2.5 px-3 text-center text-brand font-semibold">{s.afternoon}</td>
                <td className="py-2.5 px-3 text-center text-info font-semibold">{s.night}</td>
                <td className="py-2.5 px-3 text-center font-bold text-content">{s.total}</td>
                <td className="py-2.5 px-3 text-center text-muted">{s.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
