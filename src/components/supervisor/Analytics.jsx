import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Card, Avatar, PageHeader, EmptyState } from "../ui.jsx";
import { shiftHours } from "../../lib/dates.js";

// Kept in its own module and loaded lazily — recharts is roughly half the
// bundle, and reports are never the first screen a supervisor opens.
export default function AnalyticsDash({ guards, shifts }) {
  const stats = useMemo(
    () => guards.map((g) => {
      const mine = shifts.filter((s) => s.assignedGuards.includes(g.id));
      return {
        name: g.name.split(" ")[0], fullName: g.name, id: g.id, total: mine.length,
        morning: mine.filter((s) => s.type === "morning").length,
        afternoon: mine.filter((s) => s.type === "afternoon").length,
        night: mine.filter((s) => s.type === "night").length,
        hours: Math.round(mine.reduce((n, s) => n + shiftHours(s), 0)),
      };
    }),
    [guards, shifts]
  );

  const typeStats = useMemo(() => {
    const defs = [
      { type: "morning", label: "בוקר/יום", color: "#F59E0B" },
      { type: "afternoon", label: "צהריים", color: "#3B82F6" },
      { type: "night", label: "לילה", color: "#6366F1" },
    ];
    return defs
      .map((d) => ({
        name: d.label, color: d.color,
        value: shifts.filter((s) => s.type === d.type).reduce((n, s) => n + s.assignedGuards.length, 0),
      }))
      .filter((d) => d.value > 0);
  }, [shifts]);

  const totalAssigned = shifts.reduce((n, s) => n + s.assignedGuards.length, 0);

  if (!guards.length || totalAssigned === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="דוחות" subtitle="סטטיסטיקות עומס ומעקב" />
        <EmptyState icon="📈" title="אין עדיין נתונים" body="אחרי שתשבץ משמרות, כאן יופיעו גרפי עומס והתפלגות." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="דוחות" subtitle={`${totalAssigned} שיבוצים · ${guards.length} שומרים`} />
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="font-bold text-gray-800 mb-4">משמרות לפי שומר</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats} layout="vertical" margin={{ right: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, n) => [v, { morning: "בוקר/יום", afternoon: "צהריים", night: "לילה" }[n] || n]}
              />
              <Bar dataKey="morning" stackId="a" fill="#F59E0B" />
              <Bar dataKey="afternoon" stackId="a" fill="#3B82F6" />
              <Bar dataKey="night" stackId="a" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
            {[["#F59E0B", "בוקר/יום"], ["#3B82F6", "צהריים"], ["#6366F1", "לילה"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-gray-800 mb-4">התפלגות סוגי משמרות</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={typeStats} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine={false}
              >
                {typeStats.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <h2 className="font-bold text-gray-800 mb-4">פירוט לפי שומר</h2>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-gray-100">
              {["שומר", "בוקר/יום", "צהריים", "לילה", 'סה"כ', "שעות"].map((h) => (
                <th key={h} className={`py-2 px-3 font-medium text-gray-500 ${h === "שומר" ? "text-right" : "text-center"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <Avatar id={s.id} name={s.fullName} size={24} />
                    <span className="font-medium text-gray-800 text-xs">{s.fullName}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center text-amber-600 font-semibold">{s.morning}</td>
                <td className="py-2.5 px-3 text-center text-blue-600 font-semibold">{s.afternoon}</td>
                <td className="py-2.5 px-3 text-center text-indigo-600 font-semibold">{s.night}</td>
                <td className="py-2.5 px-3 text-center font-bold text-gray-900">{s.total}</td>
                <td className="py-2.5 px-3 text-center text-gray-500">{s.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
