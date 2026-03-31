import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ============================================================
// HELPERS & CONSTANTS
// ============================================================
const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const GUARD_COLORS = [
  "#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444",
  "#06B6D4","#F97316","#84CC16","#EC4899","#6366F1",
];
const getGuardColor = (id) => {
  // Deterministic color from guard id string
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return GUARD_COLORS[Math.abs(hash) % GUARD_COLORS.length];
};

const formatDateHe = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]}`;
};
const shortDate = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_HE[d.getDay()]} ${d.getDate()}`;
};
const getWeekDates = () => {
  const today = new Date("2026-03-31T12:00:00");
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
};
const WEEK_DATES = getWeekDates();

const SHIFT_DEFS = [
  { type: "morning",   label: "בוקר",   start: "07:00", end: "15:00", color: "#F59E0B" },
  { type: "afternoon", label: "צהריים", start: "15:00", end: "23:00", color: "#3B82F6" },
  { type: "night",     label: "לילה",   start: "23:00", end: "07:00", color: "#6366F1" },
];

// Generate a random 6-character team code
const generateTeamCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// ============================================================
// INITIAL DATA — DEMO ACCOUNTS
// ============================================================
const DEMO_CODE = "GUARD1"; // Demo supervisor team code

const INITIAL_ACCOUNTS = [
  {
    id: "sup_demo",
    type: "supervisor",
    name: "דוד כהן",
    email: "admin@demo.com",
    password: "1234",
    teamCode: DEMO_CODE,
    createdAt: "2026-03-01",
  },
];

const INITIAL_GUARDS = [
  { id: "g1", name: "גיא לוי",    phone: "050-1234567", teamCode: DEMO_CODE },
  { id: "g2", name: "מיכל כהן",   phone: "052-2345678", teamCode: DEMO_CODE },
  { id: "g3", name: "אבי ישראלי", phone: "054-3456789", teamCode: DEMO_CODE },
  { id: "g4", name: "רינה שמיר",  phone: "058-4567890", teamCode: DEMO_CODE },
  { id: "g5", name: "דן מזרחי",   phone: "050-5678901", teamCode: DEMO_CODE },
];

const buildInitialShifts = () => {
  let id = 1;
  const shifts = [];
  WEEK_DATES.forEach((date) => {
    SHIFT_DEFS.forEach((def) => {
      shifts.push({
        id: `s${id++}`,
        date, type: def.type, label: def.label,
        startTime: def.start, endTime: def.end,
        color: def.color, location: "כניסה ראשית",
        requiredGuards: 1, assignedGuards: [],
        published: false, supervisorCode: DEMO_CODE,
      });
    });
  });
  return shifts;
};
const INITIAL_SHIFTS = buildInitialShifts();

const demoAssign = [
  ["s1",["g1","g2"]], ["s2",["g3","g4"]], ["s3",["g5","g1"]],
  ["s4",["g2","g3"]], ["s5",["g4","g5"]], ["s6",["g1","g3"]],
];
demoAssign.forEach(([sid, gs]) => {
  const s = INITIAL_SHIFTS.find(x => x.id === sid);
  if (s) { s.assignedGuards = gs; s.published = true; }
});

const INITIAL_AVAILABILITY = {};
[
  ["g1","s1","available"],["g1","s2","unavailable"],["g1","s3","available"],
  ["g1","s4","available"],["g1","s5","maybe"],["g1","s6","unavailable"],
  ["g2","s1","available"],["g2","s2","available"],["g2","s3","unavailable"],
  ["g2","s4","available"],["g2","s5","available"],["g2","s6","maybe"],
  ["g3","s1","unavailable"],["g3","s2","available"],["g3","s3","available"],
  ["g3","s4","available"],["g3","s5","unavailable"],["g3","s6","available"],
  ["g4","s1","available"],["g4","s2","unavailable"],["g4","s3","maybe"],
  ["g4","s4","unavailable"],["g4","s5","available"],["g4","s6","available"],
  ["g5","s1","available"],["g5","s2","available"],["g5","s3","available"],
  ["g5","s4","unavailable"],["g5","s5","available"],["g5","s6","unavailable"],
].forEach(([g,s,v]) => { INITIAL_AVAILABILITY[`${g}-${s}`] = v; });

const INITIAL_SWAP_REQUESTS = [
  { id: "sr1", fromGuard: "g1", toGuard: "g2", shiftId: "s3",
    status: "pending", message: "יש לי אירוע משפחתי",
    createdAt: new Date().toISOString(), supervisorCode: DEMO_CODE },
];
const INITIAL_TASKS = [
  { id:"t1", title:"בדיקת ציוד אבטחה",  description:"לבדוק ולתעד את מצב כל הציוד", assignedTo:"g1", status:"pending", priority:"high",   dueDate: WEEK_DATES[3], supervisorCode: DEMO_CODE },
  { id:"t2", title:"עדכון יומן אירועים", description:"לעדכן את יומן האירועים",       assignedTo:"g3", status:"done",    priority:"medium", dueDate: WEEK_DATES[2], supervisorCode: DEMO_CODE },
  { id:"t3", title:"אימון נוהל חירום",   description:"השתתפות בתרגיל חירום",         assignedTo:"g5", status:"pending", priority:"high",   dueDate: WEEK_DATES[5], supervisorCode: DEMO_CODE },
];

// ============================================================
// UI PRIMITIVES
// ============================================================
const Badge = ({ children, color = "blue" }) => {
  const cls = {
    blue:"bg-blue-100 text-blue-800", green:"bg-green-100 text-green-800",
    yellow:"bg-yellow-100 text-yellow-800", red:"bg-red-100 text-red-800",
    gray:"bg-gray-100 text-gray-600", purple:"bg-purple-100 text-purple-800",
    indigo:"bg-indigo-100 text-indigo-800", amber:"bg-amber-100 text-amber-800",
  }[color] || "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
};
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_12px_48px_rgba(0,0,0,0.06)] ${className}`}>
    {children}
  </div>
);
const Btn = ({ children, onClick, variant = "primary", size = "md", disabled = false, className = "" }) => {
  const v = {
    primary:   "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger:    "bg-red-600 text-white hover:bg-red-700",
    success:   "bg-green-600 text-white hover:bg-green-700",
    ghost:     "text-gray-600 hover:bg-gray-100",
    outline:   "border border-gray-300 text-gray-700 hover:bg-gray-50",
  }[variant] || "";
  const s = { sm:"px-3 py-1.5 text-xs", md:"px-4 py-2 text-sm", lg:"px-6 py-3 text-base" }[size] || "";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors ${v} ${s} disabled:cursor-not-allowed ${className}`}>
      {children}
    </button>
  );
};
const StatCard = ({ title, value, subtitle, icon, color = "blue" }) => {
  const cls = {
    blue:"bg-blue-50 text-blue-600", green:"bg-green-50 text-green-600",
    yellow:"bg-amber-50 text-amber-600", red:"bg-red-50 text-red-600",
    purple:"bg-purple-50 text-purple-600",
  }[color] || "bg-gray-50 text-gray-600";
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${cls} flex-shrink-0`}><span className="text-2xl">{icon}</span></div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
};
const DateTabs = ({ selected, onSelect, dates }) => {
  const dts = dates || WEEK_DATES.slice(0, 7);
  return (
    <div className="flex gap-1.5 flex-wrap">
      {dts.map((d) => (
        <button key={d} onClick={() => onSelect(d)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === d ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}>
          {shortDate(d)}
        </button>
      ))}
    </div>
  );
};

const InputField = ({ label, hint, ...props }) => (
  <div>
    <label className="block text-blue-200 text-sm mb-1.5">{label}</label>
    <input {...props}
      className="w-full bg-white/10 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-blue-400 text-sm" />
    {hint && <p className="text-blue-400/70 text-xs mt-1">{hint}</p>}
  </div>
);

// ============================================================
// AUTH PAGES  (Login + Register)
// ============================================================
function AuthPage({ accounts, guards, onLogin, onRegister, onGuardJoin }) {
  const [tab, setTab]   = useState("login");  // "login" | "register"
  const [mode, setMode] = useState(null);     // "supervisor" | "guard"

  // Supervisor login
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  // Guard join/login
  const [teamCode, setTeamCode] = useState("");
  const [guardName, setGuardName] = useState("");
  // Supervisor register
  const [regName, setRegName]     = useState("");
  const [regEmail, setRegEmail]   = useState("");
  const [regPass, setRegPass]     = useState("");
  const [regPass2, setRegPass2]   = useState("");
  // Success state (after registration)
  const [newCode, setNewCode]     = useState(null);
  const [error, setError]         = useState("");

  const reset = () => {
    setMode(null); setError(""); setEmail(""); setPassword("");
    setTeamCode(""); setGuardName(""); setNewCode(null);
    setRegName(""); setRegEmail(""); setRegPass(""); setRegPass2("");
  };

  // --- Supervisor login ---
  const handleSupLogin = async () => {
    // 1. Local check
    let acc = accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password);
    
    // 2. Cloud check if local fails (for new devices)
    if (!acc) {
      try {
        const { data: dbProfiles } = await supabase.from('profiles')
          .select('*').eq('role', 'supervisor').ilike('id', email.split('@')[0]); // simplified mapping
        // For now, let's just use email check if we had auth, but since we use mock:
        // We'll rely on local + Sync button for now, or fetch all sups on mount.
      } catch (e) { console.error(e); }
    }

    if (!acc) { setError("אימייל או סיסמה שגויים"); return; }
    onLogin({ ...acc });
  };

  // --- Guard join ---
  const handleGuardJoin = async () => {
    if (!teamCode.trim()) { setError("יש להזין קוד צוות"); return; }
    if (!guardName.trim()) { setError("יש להזין שם"); return; }
    const acc = accounts.find(a => a.teamCode === teamCode.trim().toUpperCase());
    if (!acc) { setError("קוד צוות לא קיים — בדוק עם האחמ\"ש שלך"); return; }
    await onGuardJoin(teamCode.trim().toUpperCase(), guardName.trim());
  };

  // --- Supervisor register ---
  const handleRegister = () => {
    if (!regName.trim())  { setError("יש להזין שם מלא"); return; }
    if (!regEmail.trim()) { setError("יש להזין אימייל"); return; }
    if (regPass.length < 4) { setError("הסיסמה חייבת להיות לפחות 4 תווים"); return; }
    if (regPass !== regPass2) { setError("הסיסמאות לא תואמות"); return; }
    if (accounts.find(a => a.email.toLowerCase() === regEmail.trim().toLowerCase())) {
      setError("אימייל זה כבר רשום במערכת"); return;
    }
    const code = generateTeamCode();
    const newAcc = {
      id: `sup_${Date.now()}`, type: "supervisor",
      name: regName.trim(), email: regEmail.trim().toLowerCase(),
      password: regPass, teamCode: code, createdAt: new Date().toISOString(),
    };
    onRegister(newAcc);
    setNewCode(code);
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-4 shadow-2xl">
            <span className="text-4xl">🛡️</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Guardian Shifts</h1>
          <p className="text-blue-300 mt-1.5 text-sm">מערכת מקצועית לניהול משמרות מאבטחים</p>
        </div>

        {/* ── SUCCESS SCREEN (after supervisor register) ── */}
        {newCode ? (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-7 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-white font-bold text-xl mb-2">החשבון נוצר בהצלחה!</h2>
            <p className="text-blue-200 text-sm mb-6">שלח את קוד הצוות הזה לשומרים שלך כדי שיוכלו להיכנס למערכת:</p>
            <div className="bg-blue-600/40 border-2 border-blue-400 rounded-2xl p-5 mb-6">
              <p className="text-blue-300 text-xs uppercase tracking-widest mb-1">קוד הצוות שלך</p>
              <p className="text-4xl font-mono font-black text-white tracking-widest">{newCode}</p>
            </div>
            <p className="text-blue-300/70 text-xs mb-6">שמור את הקוד — תוכל לראות אותו גם בהמשך בתוך המערכת</p>
            <Btn size="lg" className="w-full" onClick={() => { setTab("login"); setMode("supervisor"); setEmail(regEmail); setNewCode(null); }}>
              המשך לכניסה
            </Btn>
          </div>
        ) : !mode ? (
          /* ── MODE SELECTOR ── */
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {[["login","כניסה"],["register","הרשמה"]].map(([key, label]) => (
                <button key={key} onClick={() => { setTab(key); reset(); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === key ? "bg-white text-gray-900 shadow-sm" : "text-white/60 hover:text-white"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "login" ? (
              <>
                <button onClick={() => setMode("supervisor")}
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-2xl p-5 text-right transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">👔</div>
                    <div className="flex-1">
                      <h2 className="text-white font-semibold">מנהל משמרת</h2>
                      <p className="text-blue-300 text-xs mt-0.5">כניסה עם אימייל וסיסמה</p>
                    </div>
                    <span className="text-white/40 group-hover:text-white transition-colors text-xl">‹</span>
                  </div>
                </button>
                <button onClick={() => setMode("guard")}
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-2xl p-5 text-right transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">👮</div>
                    <div className="flex-1">
                      <h2 className="text-white font-semibold">מאבטח</h2>
                      <p className="text-blue-300 text-xs mt-0.5">כניסה עם קוד צוות</p>
                    </div>
                    <span className="text-white/40 group-hover:text-white transition-colors text-xl">‹</span>
                  </div>
                </button>
              </>
            ) : (
              /* Register tab — supervisor only */
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
                <h2 className="text-white font-bold text-lg mb-1">🆕 יצירת חשבון מנהל משמרת</h2>
                <p className="text-blue-300 text-xs mb-5">לאחר ההרשמה תקבל קוד צוות לחלוק עם המאבטחים שלך</p>
                <div className="space-y-4">
                  <InputField label="שם מלא" placeholder="ישראל ישראלי" value={regName} onChange={e => { setRegName(e.target.value); setError(""); }} />
                  <InputField label="אימייל" type="email" placeholder="email@example.com" value={regEmail} onChange={e => { setRegEmail(e.target.value); setError(""); }} />
                  <InputField label="סיסמה (לפחות 4 תווים)" type="password" placeholder="••••••" value={regPass} onChange={e => { setRegPass(e.target.value); setError(""); }} />
                  <InputField label="אימות סיסמה" type="password" placeholder="••••••" value={regPass2} onChange={e => { setRegPass2(e.target.value); setError(""); }} />
                  {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
                  <Btn onClick={handleRegister} size="lg" className="w-full">צור חשבון וקבל קוד צוות</Btn>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── FORM SCREENS ── */
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
            <button onClick={reset} className="text-blue-300 hover:text-white text-sm mb-5 flex items-center gap-1">
              › חזרה
            </button>
            <h2 className="text-white font-bold text-xl mb-6">
              {mode === "supervisor" ? '🔐 כניסת מנהל משמרת' : "👮 כניסת מאבטח"}
            </h2>

            {mode === "supervisor" ? (
              <div className="space-y-4">
                <InputField label="אימייל" type="email" placeholder="email@example.com"
                  value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleSupLogin()} />
                <InputField label="סיסמה" type="password" placeholder="••••••"
                  value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleSupLogin()} />
                {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
                <Btn onClick={handleSupLogin} size="lg" className="w-full">כניסה</Btn>
                <p className="text-center">
                  <button onClick={() => { setTab("register"); setMode(null); setError(""); }}
                    className="text-blue-300 hover:text-white text-sm underline">
                    אין לך חשבון? הרשם כאן
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <InputField label="קוד צוות" placeholder="למשל: GUARD1"
                  hint="קבל את הקוד מהאחמ&quot;ש שלך"
                  value={teamCode} onChange={e => { setTeamCode(e.target.value.toUpperCase()); setError(""); }} />
                <InputField label="שמך המלא" placeholder="ישראל ישראלי"
                  value={guardName} onChange={e => { setGuardName(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleGuardJoin()} />
                {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
                <Btn onClick={handleGuardJoin} size="lg" className="w-full">כניסה למערכת</Btn>
                <p className="text-blue-300/60 text-xs text-center">אם זו הכניסה הראשונה שלך — ייווצר לך פרופיל אוטומטית</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUPERVISOR APP
// ============================================================
const SUP_NAV = [
  { id: "dashboard",    label: "לוח בקרה",       icon: "📊" },
  { id: "shifts",       label: "ניהול משמרות",    icon: "📅" },
  { id: "availability", label: "זמינות שומרים",   icon: "✅" },
  { id: "assignment",   label: "שיבוץ",           icon: "👥" },
  { id: "schedule",     label: "פרסום סידור",     icon: "📋" },
  { id: "swaps",        label: "בקשות החלפה",     icon: "🔄", badge: true },
  { id: "tasks",        label: "משימות",          icon: "✏️" },
  { id: "analytics",    label: "דוחות",           icon: "📈" },
  { id: "team",         label: "הצוות שלי",       icon: "🔑" },
];

function SupervisorApp({ user, guards, shifts, availability, swapRequests, tasks,
    setGuards, setShifts, setAvailability, setSwapRequests, setTasks, onLogout }) {
  const [view, setView] = useState("dashboard");
  const [weekOffset, setWeekOffset] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Compute 7-day week (Sun–Sat) based on offset
  const weekDates = useMemo(() => {
    const base = new Date("2026-03-29T12:00:00"); // fixed Sunday reference
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i + weekOffset * 7);
      return d.toISOString().split("T")[0];
    });
  }, [weekOffset]);

  const weekLabel = `${formatDateHe(weekDates[0])} — ${formatDateHe(weekDates[6])}`;

  // Filter data to this supervisor's team
  const myGuards = guards.filter(g => g.teamCode === user.teamCode);
  const myShifts = shifts.filter(s => s.supervisorCode === user.teamCode);
  const mySwaps  = swapRequests.filter(r => r.supervisorCode === user.teamCode);
  const myTasks  = tasks.filter(t => t.supervisorCode === user.teamCode);
  const pendingSwaps = mySwaps.filter(r => r.status === "pending").length;

  // Supervisor can also act as a guard on their own team
  const supervisorGuard = { id: user.id, name: `${user.name} (אחמ"ש)`, phone: "—", teamCode: user.teamCode, isSupervisor: true };
  const allTeamGuards = [...myGuards, ...( myGuards.find(g => g.id === user.id) ? [] : [supervisorGuard] )];

  const p = {
    guards: allTeamGuards, shifts: myShifts, availability, swapRequests: mySwaps, tasks: myTasks,
    allGuards: guards, allShifts: shifts,
    setGuards, setShifts, setAvailability, setSwapRequests, setTasks,
    supervisorCode: user.teamCode,
    weekDates,
  };

  const views = {
    dashboard:    <SupDashboard    {...p} />,
    shifts:       <ShiftMgmt      {...p} />,
    availability: <AvailView      {...p} />,
    assignment:   <AssignView     {...p} />,
    schedule:     <ScheduleMgmt   {...p} />,
    swaps:        <SwapMgmt       {...p} />,
    tasks:        <TaskMgmt       {...p} />,
    analytics:    <AnalyticsDash  {...p} />,
    team:         <TeamView       {...p} user={user} />,
  };

  // Views that should show the week navigator
  const showNav = ["shifts", "availability", "assignment", "schedule"].includes(view);

  const handleCloudSync = async () => {
    try {
      // 1. Profiles
      const profiles = allTeamGuards.map(g => ({
        id: g.id, full_name: g.name, phone: g.phone,
        role: g.isSupervisor ? 'supervisor' : 'guard', team_code: g.teamCode
      }));
      await supabase.from('profiles').upsert(profiles, { onConflict: 'id' });

      // 2. Shifts
      const dbShifts = shifts.map(s => ({
        id: s.id, date: s.date, type: s.type, label: s.label,
        start_time: s.startTime, end_time: s.endTime, color: s.color,
        location: s.location, required_guards: s.requiredGuards,
        supervisor_code: s.supervisorCode, published: s.published
      }));
      await supabase.from('shifts').upsert(dbShifts, { onConflict: 'id' });

      // 3. Assignments
      const assignments = [];
      shifts.forEach(s => (s.assignedGuards || []).forEach(gId => assignments.push({ shift_id: s.id, guard_id: gId })));
      if (assignments.length) await supabase.from('assignments').upsert(assignments, { onConflict: 'shift_id,guard_id' });

      alert("✅ הסנכרון לענן הושלם בהצלחה!");
    } catch (e) {
      console.error(e);
      alert("❌ שגיאה בסנכרון: " + e.message);
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F5F7]" dir="rtl">
      {/* Mobile Backdrop */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-lg ring-1 ring-white/20">🛡️</div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm tracking-tight">Guardian Shifts</p>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider opacity-70">אחמ"ש: {user.name}</p>
            </div>
          </div>
          <button onClick={() => { setView("team"); setIsMenuOpen(false); }}
            className="mt-4 w-full flex items-center justify-between bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl px-3 py-2 transition-all group">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-blue-400 font-bold">TEAM</span>
              <span className="font-mono font-bold text-white text-sm tracking-[0.2em]">{user.teamCode}</span>
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">📋</span>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {SUP_NAV.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                view === item.id 
                ? "bg-white/10 text-white shadow-lg ring-1 ring-white/10" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}>
              <span className={`text-lg ${view === item.id ? "scale-110" : "opacity-70"}`}>{item.icon}</span>
              <span className="flex-1 text-right">{item.label}</span>
              {item.badge && pendingSwaps > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
                  {pendingSwaps}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-all">
            <span className="opacity-70">🚪</span><span>התנתקות</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1 className="font-bold text-gray-900 tracking-tight text-lg">
              {SUP_NAV.find(n => n.id === view)?.label || "Guardian"}
            </h1>
          </div>
          {showNav && (
            <div className="hidden sm:block">
              <WeekNavigator offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
            </div>
          )}
          <div className="flex items-center gap-3">
             <button onClick={handleCloudSync} title="סנכרן נתונים לענן"
               className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-blue-100 shadow-sm flex items-center gap-2 px-3">
               <span className="text-xs font-bold hidden md:inline">סנכרון ענן</span>
               <span>☁️</span>
             </button>
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 border border-blue-200">{user.name.charAt(0)}</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6 pb-20 lg:pb-0">
            {showNav && (
               <div className="sm:hidden mb-4 flex justify-center">
                 <WeekNavigator offset={weekOffset} setOffset={setWeekOffset} dates={weekDates} />
               </div>
            )}
            {views[view]}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// SUPERVISOR — TEAM VIEW (code sharing + guard list)
// ============================================================
function TeamView({ user, guards, setGuards }) {
  const [copied, setCopied]   = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");

  const copyCode = () => {
    navigator.clipboard?.writeText(user.teamCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addGuard = () => {
    if (!addName.trim()) return;
    const exists = guards.find(g => g.name.trim().toLowerCase() === addName.trim().toLowerCase() && g.teamCode === user.teamCode);
    if (exists) return;
    setGuards(p => [...p, {
      id: `g${Date.now()}`,
      name: addName.trim(),
      phone: addPhone.trim() || "—",
      teamCode: user.teamCode,
    }]);
    setAddName(""); setAddPhone("");
  };

  const removeGuard = (id) => setGuards(p => p.filter(g => g.id !== id));

  const shareMsg = `שלום! אני מזמין אותך להצטרף למערכת Guardian Shifts.\nקוד הצוות שלנו: ${user.teamCode}\nנכנסים לאפליקציה, בוחרים "שומר / מאבטח" ומזינים את הקוד.`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הצוות שלי</h1>
        <p className="text-gray-500 text-sm">נהל את השומרים ושתף את קוד הצוות</p>
      </div>

      {/* Team code card */}
      <Card className="border-2 border-blue-200 bg-blue-50/40">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">🔑 קוד הצוות שלך</h2>
            <p className="text-sm text-gray-500 max-w-sm">שלח קוד זה לשומרים — הם יזינו אותו בעת הכניסה הראשונה למערכת</p>
          </div>
          <div className="text-center">
            <div className="bg-white border-2 border-blue-300 rounded-2xl px-8 py-4 mb-3 shadow-sm">
              <p className="text-4xl font-mono font-black text-blue-700 tracking-widest">{user.teamCode}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Btn onClick={copyCode} variant={copied ? "success" : "primary"} size="sm">
                {copied ? "✅ הועתק!" : "📋 העתק קוד"}
              </Btn>
            </div>
          </div>
        </div>
        {/* Shareable message */}
        <div className="mt-4 p-3 bg-white rounded-xl border border-blue-100">
          <p className="text-xs text-gray-400 mb-1">הודעה מוכנה לשליחה:</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{shareMsg}</p>
        </div>
      </Card>

      {/* Add guard manually */}
      <Card>
        <h2 className="font-semibold text-gray-800 mb-4">➕ הוסף שומר ידנית</h2>
        <div className="flex gap-3 flex-wrap">
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="שם מלא"
            onKeyDown={e => e.key === "Enter" && addGuard()}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" />
          <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="טלפון (אופציונלי)"
            className="border rounded-lg px-3 py-2 text-sm w-40" />
          <Btn onClick={addGuard} disabled={!addName.trim()}>הוסף</Btn>
        </div>
      </Card>

      {/* Guards list */}
      <Card>
        <h2 className="font-semibold text-gray-800 mb-4">👥 רשימת השומרים ({guards.length})</h2>
        {guards.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">אין שומרים עדיין — הוסף ידנית או שתף את קוד הצוות</p>
        ) : (
          <div className="space-y-2">
              {guards.map(g => (
                <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: getGuardColor(g.id) }}>
                      {g.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{g.name} {g.isSupervisor ? '⭐' : ''}</p>
                      <p className="text-xs text-gray-400">{g.phone || "—"}</p>
                    </div>
                  </div>
                  {!g.isSupervisor && (
                    <button onClick={() => removeGuard(g.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg">🗑️</button>
                  )}
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// SUPERVISOR — DASHBOARD
// ============================================================
function SupDashboard({ guards, shifts, swapRequests, tasks }) {
  const today = "2026-03-31";
  const todayShifts = shifts.filter(s => s.date === today);
  const filledToday = todayShifts.filter(s => s.assignedGuards.length >= s.requiredGuards).length;
  const pendingSwaps = swapRequests.filter(r => r.status === "pending").length;
  const openTasks = tasks.filter(t => t.status !== "done").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
        <p className="text-gray-500 text-sm">ברוך הבא! סיכום מצב הצוות לשבוע הנוכחי</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="שומרים בצוות"  value={guards.length}          icon="👮" color="blue"   />
        <StatCard title="משמרות היום"    value={todayShifts.length}     subtitle={`${filledToday} מאוישות`} icon="📅" color="green" />
        <StatCard title="בקשות החלפה"   value={pendingSwaps}           subtitle="ממתינות" icon="🔄" color="yellow" />
        <StatCard title="משימות פתוחות" value={openTasks}              icon="✏️" color="purple" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">📅 משמרות היום</h2>
          <div className="space-y-3">
            {todayShifts.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl text-white shadow-sm" style={{ background: s.color }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm bg-black/10 px-2 py-0.5 rounded-lg">{s.label}</span>
                    <span className="opacity-90 text-xs font-medium">{s.startTime}–{s.endTime}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.assignedGuards.length === 0
                      ? <span className="bg-black/30 px-2 py-1 rounded-md text-xs font-semibold text-white/90">לא משובץ</span>
                      : s.assignedGuards.map(gid => {
                          const g = guards.find(x => x.id === gid);
                          return g ? <span key={gid} className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium">{g.name}</span> : null;
                        })}
                  </div>
                </div>
                <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded-lg">
                  {s.assignedGuards.length}/{s.requiredGuards}
                </span>
              </div>
            ))}
            {todayShifts.length === 0 && <p className="text-gray-400 text-sm text-center py-4">אין משמרות להיום</p>}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">👥 עומס שומרים השבוע</h2>
          <div className="space-y-3">
            {guards.map(g => {
              const count = shifts.filter(s => s.assignedGuards.includes(g.id)).length;
              const color = getGuardColor(g.id);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>
                        {g.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{g.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{count} משמרות</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100,(count/5)*100)}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            {guards.length === 0 && <p className="text-gray-400 text-sm text-center py-4">הוסף שומרים מתפריט "הצוות שלי"</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// SUPERVISOR — SHIFT MANAGEMENT
// ============================================================
function ShiftMgmt({ shifts, setShifts, supervisorCode, weekDates: wdProp }) {
  const weekDates = wdProp || WEEK_DATES.slice(0, 7);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date: weekDates[0], startTime: "07:00", endTime: "15:00", label: "", location: "כניסה ראשית", requiredGuards: 1 });

  // Reset selected date when week changes
  useEffect(() => {
    setForm(p => ({ ...p, date: weekDates[0] }));
  }, [weekDates[0]]);

  const grouped = useMemo(() => {
    const m = {};
    weekDates.forEach(d => { m[d] = shifts.filter(s => s.date === d && !s.published); });
    return m;
  }, [shifts, weekDates]);

  const saveShift = () => {
    if (editId) {
      setShifts(p => p.map(s => s.id === editId ? { ...s, ...form, label: form.label || `${form.startTime}–${form.endTime}` } : s));
    } else {
      const typeMap = { "07:00":"morning", "15:00":"afternoon", "23:00":"night", "19:00":"night" };
      setShifts(p => [...p, {
        ...form, id: `s${Date.now()}`,
        type: typeMap[form.startTime] || "custom",
        color: form.startTime === "19:00" ? "#6366F1" : "#3B82F6",
        label: form.label || `${form.startTime}–${form.endTime}`,
        assignedGuards: [], published: false, supervisorCode,
      }]);
    }
    setShowForm(false);
    setEditId(null);
  };

  const populateWeek = () => {
    const newShifts = [];
    let idCounter = Date.now();
    weekDates.forEach(date => {
      newShifts.push({ id: `s${idCounter++}`, date, startTime: "07:00", endTime: "19:00", label: "משמרת יום", location: "כניסה ראשית", requiredGuards: 1, type: "morning", color: "#3B82F6", assignedGuards: [], published: false, supervisorCode });
      newShifts.push({ id: `s${idCounter++}`, date, startTime: "19:00", endTime: "07:00", label: "משמרת לילה", location: "כניסה ראשית", requiredGuards: 1, type: "night", color: "#6366F1", assignedGuards: [], published: false, supervisorCode });
    });
    setShifts(p => [...p, ...newShifts]);
  };

  const openEdit = (s) => {
    setForm(s);
    setEditId(s.id);
    setShowForm(true);
  };

  const deleteShift = id => setShifts(p => p.filter(s => s.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משמרות</h1>
          <p className="text-gray-500 text-sm">הגדר את משמרות השבוע</p>
        </div>
        <div className="flex gap-2 relative">
          <Btn onClick={() => { 
            setForm({ date: weekDates[0], startTime: "07:00", endTime: "15:00", label: "", location: "כניסה ראשית", requiredGuards: 1 }); 
            setEditId(null); 
            setShowForm(true); 
          }}>+ הוסף משמרת</Btn>
          
          <Btn variant="secondary" onClick={populateWeek}>⚡ מלא שבוע זה</Btn>
        </div>
      </div>

      {showForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-blue-900">{editId ? "✏️ עריכת משמרת" : "➕ משמרת חדשה"}</h3>
            <div className="flex gap-2">
              <span className="text-sm text-blue-800 self-center">תבניות מהירות (12 שע'):</span>
              <Btn size="sm" variant="outline" onClick={() => setForm(p => ({...p, startTime:"07:00", endTime:"19:00", label:"משמרת יום"}))}>משמרת יום</Btn>
              <Btn size="sm" variant="outline" onClick={() => setForm(p => ({...p, startTime:"19:00", endTime:"07:00", label:"משמרת לילה"}))}>משמרת לילה</Btn>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:"תאריך", el: <select value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">{weekDates.map(d => <option key={d} value={d}>{formatDateHe(d)}</option>)}</select> },
              { label:"שעת התחלה", el: <input type="time" value={form.startTime} onChange={e => setForm(p => ({...p, startTime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /> },
              { label:"שעת סיום",  el: <input type="time" value={form.endTime}   onChange={e => setForm(p => ({...p, endTime: e.target.value}))}   className="w-full border rounded-lg px-3 py-2 text-sm" /> },
              { label:"מיקום",    el: <input type="text" value={form.location}  onChange={e => setForm(p => ({...p, location: e.target.value}))}  className="w-full border rounded-lg px-3 py-2 text-sm" /> },
              { label:"נדרשים",  el: <input type="number" min="1" max="10" value={form.requiredGuards} onChange={e => setForm(p => ({...p, requiredGuards: +e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /> },
              { label:"תווית",   el: <input type="text" placeholder="בוקר / לילה..." value={form.label} onChange={e => setForm(p => ({...p, label: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" /> },
            ].map(({ label, el }) => (
              <div key={label}><label className="block text-sm text-gray-600 mb-1">{label}</label>{el}</div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Btn onClick={saveShift}>{editId ? "שמור שינויים" : "שמור משמרת"}</Btn>
            <Btn variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>ביטול</Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map(date => (
          <div key={date}>
            <div className="text-center mb-2 pb-2 border-b border-gray-200">
              <p className="text-xs text-gray-400">{DAYS_HE[new Date(date+"T12:00:00").getDay()]}</p>
              <p className="text-sm font-bold text-gray-800">{new Date(date+"T12:00:00").getDate()}</p>
            </div>
            <div className="space-y-1.5">
              {(grouped[date]||[]).map(s => (
                <div key={s.id} onClick={() => openEdit(s)} className="rounded-lg p-2.5 text-xs relative group cursor-pointer hover:brightness-95 transition-all shadow-sm" style={{ background: s.color, color: "#fff" }} title="לחץ לעריכת המשמרת">
                  <div className="font-bold text-[13px]">{s.label}</div>
                  <div className="opacity-90 mt-0.5">{s.startTime}–{s.endTime}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.assignedGuards.map(gid => {
                      const g = guards?.find(x => x.id === gid);
                      if (!g) return null;
                      const color = getGuardColor(g.id);
                      return (
                        <span key={gid} 
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: color }}>
                          {g.name}
                        </span>
                      );
                    })}
                    {s.assignedGuards.length === 0 && <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] text-white/90">לא משובץ</span>}
                  </div>
                  <div className="absolute bottom-2 left-2 text-[10px] opacity-75 font-semibold">
                    {s.assignedGuards.length}/{s.requiredGuards}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteShift(s.id); }}
                    className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 bg-white/90 hover:bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">✕</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SUPERVISOR — AVAILABILITY VIEW
// ============================================================
function AvailView({ guards, shifts, availability, weekDates: wdProp }) {
  const weekDates = wdProp || WEEK_DATES.slice(0, 7);
  const [date, setDate] = useState(weekDates[0]);
  useEffect(() => { if (!weekDates.includes(date)) setDate(weekDates[0]); }, [weekDates[0]]);
  const dayShifts = shifts.filter(s => s.date === date);
  const icon = { available:"✅", unavailable:"❌", maybe:"🤔" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">זמינות שומרים</h1>
        <p className="text-gray-500 text-sm">סקירת הזמינות שהוגשה לכל משמרת</p>
      </div>
      <DateTabs selected={date} onSelect={setDate} dates={weekDates} />
      {dayShifts.length === 0
        ? <Card><p className="text-center text-gray-400 py-10">אין משמרות לתאריך זה</p></Card>
        : <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-right py-3 px-4 font-medium text-gray-500">שומר</th>
                  {dayShifts.map(s => (
                    <th key={s.id} className="text-center py-3 px-4 font-medium text-gray-500">
                      <div>{s.label}</div>
                      <div className="text-xs font-normal text-gray-400">{s.startTime}–{s.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guards.map(g => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-800 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getGuardColor(g.id) }} />
                      {g.name}
                    </td>
                    {dayShifts.map(s => {
                      const aObj = availability[`${g.id}-${s.id}`];
                      const a = aObj?.status || aObj;
                      return (
                        <td key={s.id} className="py-3 px-4 text-center">
                          <div className="text-lg">{icon[a] || <span className="text-gray-300 text-base">—</span>}</div>
                          {aObj?.comment && <div className="text-[10px] text-gray-500 mt-1 max-w-[80px] mx-auto truncate" title={aObj.comment}>💬 {aObj.comment}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex gap-4 text-xs text-gray-500 border-t pt-3">
              <span>✅ זמין</span><span>❌ לא זמין</span><span>— לא הגיש</span>
            </div>
          </Card>
      }
    </div>
  );
}

// ============================================================
// SUPERVISOR — ASSIGNMENT
// ============================================================
function AssignView({ guards, shifts, availability, setShifts, weekDates: wdProp }) {
  const weekDates = wdProp || WEEK_DATES.slice(0, 7);
  const [date, setDate] = useState(weekDates[0]);
  useEffect(() => { if (!weekDates.includes(date)) setDate(weekDates[0]); }, [weekDates[0]]);
  const dayShifts = shifts.filter(s => s.date === date);

  const toggle = (shiftId, guardId) => {
    const target = shifts.find(s => s.id === shiftId);
    if (!target) return;

    const isAssigned = target.assignedGuards.includes(guardId);

    if (!isAssigned) {
      // 12h Consecutive Check
      const myShifts = shifts.filter(s => s.assignedGuards.includes(guardId) && s.id !== shiftId);
      const all = [...myShifts, target].map(s => {
        const start = new Date(`${s.date}T${s.startTime}:00`).getTime();
        let end = new Date(`${s.date}T${s.endTime}:00`).getTime();
        if (end <= start) end += 24 * 3600 * 1000;
        return { start, end };
      }).sort((a,b) => a.start - b.start);

      // Find block containing target
      const tStart = new Date(`${target.date}T${target.startTime}:00`).getTime();
      let blockStart = tStart;
      let blockEnd = tStart === new Date(`${target.date}T${target.endTime}:00`).getTime() + (24*3600*1000) ? tStart : new Date(`${target.date}T${target.endTime}:00`).getTime();
      if (blockEnd <= blockStart) blockEnd += 24 * 3600 * 1000;

      // Expand backwards
      let changed = true;
      while(changed) {
        changed = false;
        const prev = all.find(s => s.end === blockStart);
        if (prev) { blockStart = prev.start; changed = true; }
      }
      // Expand forwards
      changed = true;
      while(changed) {
        changed = false;
        const next = all.find(s => s.start === blockEnd);
        if (next) { blockEnd = next.end; changed = true; }
      }

      const totalHours = (blockEnd - blockStart) / (3600 * 1000);
      if (totalHours > 12) {
        alert(`⚠️ חריגה! השיבוץ יביא ל-${totalHours} שעות עבודה רצופות (המקסימום הוא 12).`);
        return;
      }

      // Supabase Push
      supabase.from('assignments').insert({ shift_id: shiftId, guard_id: guardId }).catch(e => console.error("Cloud Assign Error:", e));
    } else {
      // Supabase Remove
      supabase.from('assignments').delete().match({ shift_id: shiftId, guard_id: guardId }).catch(e => console.error("Cloud Unassign Error:", e));
    }

    setShifts(p => p.map(s => {
      if (s.id !== shiftId) return s;
      const next = isAssigned
        ? s.assignedGuards.filter(g => g !== guardId)
        : [...s.assignedGuards, guardId];
      return { ...s, assignedGuards: next };
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">שיבוץ שומרים</h1>
        <p className="text-gray-500 text-sm">לחץ על שומר כדי לשבץ / לבטל שיבוץ</p>
      </div>
      <DateTabs selected={date} onSelect={setDate} dates={weekDates} />
      {dayShifts.length === 0
        ? <Card><p className="text-center text-gray-400 py-10">אין משמרות לתאריך זה</p></Card>
        : dayShifts.map(shift => (
          <div key={shift.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 text-white flex items-center justify-between" style={{ background: shift.color }}>
              <div>
                <h3 className="font-bold text-lg">{shift.label} <span className="opacity-80 text-sm font-medium mr-2">{shift.startTime}–{shift.endTime}</span></h3>
                <p className="text-sm opacity-90 mt-1">📍 {shift.location} · נדרשים {shift.requiredGuards} שומרים</p>
              </div>
              <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-xl font-bold text-sm shadow-inner">
                משובצים: {shift.assignedGuards.length}/{shift.requiredGuards}
              </div>
            </div>
            <div className="p-5">
            {guards.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">הוסף שומרים תחילה מ"הצוות שלי"</p>
              : <div className="grid grid-cols-5 gap-2">
                  {guards.map(g => {
                    const avail = availability[`${g.id}-${shift.id}`];
                    const assigned = shift.assignedGuards.includes(g.id);
                    return (
                      <button key={g.id} onClick={() => toggle(shift.id, g.id)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          assigned            ? "border-blue-500 bg-blue-50 shadow-sm"
                          : (avail?.status || avail) === "available" ? "border-green-200 bg-green-50 hover:border-green-400"
                          : (avail?.status || avail) === "unavailable" ? "border-red-100 bg-red-50/50 opacity-50"
                          : (avail?.status || avail) === "maybe"     ? "border-yellow-200 bg-yellow-50"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300"
                        }`}>
                        <div className="w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-white font-bold text-xs" 
                          style={{ backgroundColor: getGuardColor(g.id), opacity: (!assigned && (avail?.status || avail) === "unavailable") ? 0.5 : 1 }}>
                          {assigned ? "✓" : g.name.charAt(0)}
                        </div>
                        <div className="text-xs font-semibold text-gray-800 truncate">{g.name.split(" ")[0]}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {assigned ? "משובץ" : (avail?.status || avail) === "available" ? "זמין" : (avail?.status || avail) === "unavailable" ? "לא זמין" : (avail?.status || avail) === "maybe" ? "אולי" : "לא ידוע"}
                        </div>
                        {(avail?.comment) && <div className="mt-1 text-[10px] text-blue-600 truncate max-w-[60px] mx-auto" title={avail.comment}>💬 {avail.comment}</div>}
                      </button>
                    );
                  })}
                </div>
            }
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ============================================================
// SUPERVISOR — SCHEDULE PUBLISH
// ============================================================
function ScheduleMgmt({ guards, shifts, setShifts, weekDates: wdProp }) {
  const weekDates = wdProp || WEEK_DATES.slice(0, 7);
  const publishDay = date => setShifts(p => p.map(s => s.date === date ? {...s, published: true}  : s));
  const unpublishDay = date => setShifts(p => p.map(s => s.date === date ? {...s, published: false} : s));
  const publishAll = () => setShifts(p => p.map(s => ({...s, published: true})));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">פרסום סידור עבודה</h1>
          <p className="text-gray-500 text-sm">פרסם את הסידור כדי שהשומרים יוכלו לצפות בו</p>
        </div>
        <Btn onClick={publishAll} variant="success">פרסם הכל ✅</Btn>
      </div>
      {weekDates.map(date => {
        const dayShifts = shifts.filter(s => s.date === date);
        const allPub = dayShifts.length > 0 && dayShifts.every(s => s.published);
        return (
          <Card key={date}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{formatDateHe(date)}</h3>
                <p className="text-xs text-gray-400">{dayShifts.length} משמרות</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={allPub ? "green" : "gray"}>{allPub ? "✅ מפורסם" : "📝 טיוטה"}</Badge>
                {allPub
                  ? <Btn size="sm" variant="outline" onClick={() => unpublishDay(date)}>ביטול פרסום</Btn>
                  : <Btn size="sm" onClick={() => publishDay(date)}>פרסם יום</Btn>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {dayShifts.map(s => (
                <div key={s.id} className="p-3 rounded-xl shadow-sm text-white relative" style={{ background: s.color }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm tracking-wide bg-black/10 px-2 py-0.5 rounded-lg">{s.label}</span>
                    <span className="text-xs opacity-90 font-medium">{s.startTime}–{s.endTime}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                  {s.assignedGuards.length === 0
                    ? <span className="bg-black/30 px-2 py-1 rounded-md text-xs font-semibold text-white/90">לא משובץ</span>
                    : s.assignedGuards.map(gid => {
                        const g = guards.find(x => x.id === gid);
                        if (!g) return null;
                        const color = getGuardColor(g.id);
                        return (
                          <span key={gid} 
                            className="backdrop-blur-sm border border-white/20 px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm"
                            style={{ backgroundColor: color + '99' }}> {/* 99 for some transparency */}
                            {g.name}
                          </span>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// SUPERVISOR — SWAP REQUESTS
// ============================================================
function SwapMgmt({ guards, shifts, swapRequests, setSwapRequests }) {
  const gName = id => guards.find(g => g.id === id)?.name || id;
  const getShift = id => shifts.find(s => s.id === id);
  const decide = (id, ok) => setSwapRequests(p => p.map(r => r.id === id ? {...r, status: ok ? "approved" : "rejected"} : r));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">בקשות החלפת משמרות</h1>
        <p className="text-gray-500 text-sm">אשר או דחה בקשות החלפה</p>
      </div>
      {swapRequests.length === 0
        ? <Card><p className="text-center text-gray-400 py-10">אין בקשות החלפה</p></Card>
        : swapRequests.map(r => {
            const s = getShift(r.shiftId);
            return (
              <Card key={r.id} className={r.status === "pending" ? "border-amber-200" : ""}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">🔄</div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{gName(r.fromGuard)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold">{gName(r.toGuard)}</span>
                        <Badge color={{pending:"yellow",approved:"green",rejected:"red"}[r.status]}>
                          {{pending:"ממתין",approved:"אושר",rejected:"נדחה"}[r.status]}
                        </Badge>
                      </div>
                      {s && <p className="text-sm text-gray-500 mt-1">{formatDateHe(s.date)} | {s.label} {s.startTime}–{s.endTime}</p>}
                      {r.message && <p className="text-sm text-gray-600 mt-1">💬 {r.message}</p>}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Btn variant="success" size="sm" onClick={() => decide(r.id, true)}>אשר ✅</Btn>
                      <Btn variant="danger"  size="sm" onClick={() => decide(r.id, false)}>דחה ❌</Btn>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
      }
    </div>
  );
}

// ============================================================
// SUPERVISOR — TASK MANAGER
// ============================================================
function TaskMgmt({ guards, tasks, setTasks, supervisorCode }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", assignedTo:"", priority:"medium", dueDate: WEEK_DATES[0] });

  const add = () => {
    if (!form.title || !form.assignedTo) return;
    setTasks(p => [...p, { ...form, id:`t${Date.now()}`, status:"pending", supervisorCode }]);
    setShowForm(false);
    setForm({ title:"", description:"", assignedTo:"", priority:"medium", dueDate: WEEK_DATES[0] });
  };
  const toggle = id => setTasks(p => p.map(t => t.id===id ? {...t, status: t.status==="done"?"pending":"done"} : t));
  const del    = id => setTasks(p => p.filter(t => t.id !== id));
  const prioClr = { high:"red", medium:"yellow", low:"blue" };
  const prioLbl = { high:"🔴 גבוהה", medium:"🟡 בינונית", low:"🔵 נמוכה" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משימות</h1>
          <p className="text-gray-500 text-sm">הגדר ועקוב אחר משימות הצוות</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ משימה חדשה</Btn>
      </div>
      {showForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <h3 className="font-semibold mb-4 text-blue-900">➕ משימה חדשה</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-600 mb-1">כותרת</label><input type="text" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="שם המשימה" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm text-gray-600 mb-1">מוקצה ל</label>
              <select value={form.assignedTo} onChange={e => setForm(p => ({...p, assignedTo: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">בחר שומר</option>
                {guards.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">עדיפות</label>
              <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="high">גבוהה</option><option value="medium">בינונית</option><option value="low">נמוכה</option>
              </select>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">תאריך יעד</label>
              <select value={form.dueDate} onChange={e => setForm(p => ({...p, dueDate: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {WEEK_DATES.map(d => <option key={d} value={d}>{formatDateHe(d)}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">תיאור</label><textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Btn onClick={add}>שמור</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>ביטול</Btn>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {tasks.length === 0 && <Card><p className="text-center text-gray-400 py-10">אין משימות</p></Card>}
        {tasks.map(t => {
          const g = guards.find(x => x.id === t.assignedTo);
          return (
            <Card key={t.id} className={t.status === "done" ? "opacity-60" : ""}>
              <div className="flex items-center gap-4">
                <button onClick={() => toggle(t.id)} className="text-2xl flex-shrink-0">{t.status==="done" ? "✅" : "⬜"}</button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${t.status==="done" ? "line-through text-gray-400" : "text-gray-900"}`}>{t.title}</span>
                    <Badge color={prioClr[t.priority]}>{prioLbl[t.priority]}</Badge>
                  </div>
                  {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    {g && <span>👤 {g.name}</span>}
                    <span>📅 {formatDateHe(t.dueDate)}</span>
                  </div>
                </div>
                <button onClick={() => del(t.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg flex-shrink-0">🗑️</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SUPERVISOR — ANALYTICS
// ============================================================
function AnalyticsDash({ guards, shifts }) {
  const guardStats = useMemo(() => guards.map(g => {
    const mine = shifts.filter(s => s.assignedGuards.includes(g.id));
    return {
      name: g.name.split(" ")[0], fullName: g.name, total: mine.length,
      morning:   mine.filter(s => s.type === "morning").length,
      afternoon: mine.filter(s => s.type === "afternoon").length,
      night:     mine.filter(s => s.type === "night").length,
    };
  }), [guards, shifts]);

  const typeStats = useMemo(() =>
    SHIFT_DEFS.map(def => ({
      name: def.label,
      value: shifts.filter(s => s.type === def.type && s.assignedGuards.length > 0)
               .reduce((n, s) => n + s.assignedGuards.length, 0),
    })), [shifts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דוחות ואנליטיקה</h1>
        <p className="text-gray-500 text-sm">סטטיסטיקות עומס עבודה ומעקב צוות</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">משמרות לפי שומר</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={guardStats} layout="vertical" margin={{ right: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v,n) => [v, n==="morning"?"בוקר":n==="afternoon"?"צהריים":"לילה"]} />
              <Bar dataKey="morning"   stackId="a" fill="#F59E0B" />
              <Bar dataKey="afternoon" stackId="a" fill="#3B82F6" />
              <Bar dataKey="night"     stackId="a" fill="#6366F1" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
            {[["#F59E0B","בוקר"],["#3B82F6","צהריים"],["#6366F1","לילה"]].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">התפלגות סוגי משמרות</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeStats} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                dataKey="value" nameKey="name" label={({name, value}) => `${name}: ${value}`} labelLine={false}>
                {typeStats.map((_,i) => <Cell key={i} fill={["#F59E0B","#3B82F6","#6366F1"][i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold text-gray-800 mb-4">פירוט שעות לפי שומר</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["שומר","בוקר","צהריים","לילה",'סה"כ',"שעות"].map(h => (
                <th key={h} className={`py-2.5 px-4 font-medium text-gray-500 ${h==="שומר"?"text-right":"text-center"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guardStats.map(s => (
              <tr key={s.fullName} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4 font-medium text-gray-800">{s.fullName}</td>
                <td className="py-3 px-4 text-center text-amber-600 font-medium">{s.morning}</td>
                <td className="py-3 px-4 text-center text-blue-600 font-medium">{s.afternoon}</td>
                <td className="py-3 px-4 text-center text-indigo-600 font-medium">{s.night}</td>
                <td className="py-3 px-4 text-center font-bold text-gray-900">{s.total}</td>
                <td className="py-3 px-4 text-center text-gray-500">{s.total*8} ש'</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ============================================================
// GUARD APP
// ============================================================
const GUARD_NAV = [
  { id:"schedule",     label:"הסידור שלי",    icon:"📅" },
  { id:"availability", label:"הגשת זמינות",   icon:"✅" },
  { id:"swaps",        label:"בקשות החלפה",   icon:"🔄", badge: true },
];

function GuardApp({ user, guards, shifts, availability, swapRequests,
    setAvailability, setSwapRequests, onLogout }) {
  const [view, setView] = useState("schedule");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const incoming = swapRequests.filter(r => r.toGuard === user.id && r.status === "pending").length;

  // Only shifts from this guard's team
  const myTeamShifts = shifts.filter(s => s.supervisorCode === user.teamCode);
  const mySwaps = swapRequests.filter(r =>
    (r.fromGuard === user.id || r.toGuard === user.id) && r.supervisorCode === user.teamCode
  );
  const teamGuards = guards.filter(g => g.teamCode === user.teamCode);

  const p = { user, guards: teamGuards, shifts: myTeamShifts, availability,
    swapRequests: mySwaps, setAvailability, setSwapRequests };

  const views = {
    schedule:     <GuardScheduleView {...p} />,
    availability: <GuardAvailView    {...p} />,
    swaps:        <GuardSwapsView    {...p} />,
  };

  return (
    <div className="flex h-screen bg-[#F5F5F7]" dir="rtl">
      {/* Mobile Backdrop */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg ring-2 ring-white/10 transition-all"
              style={{ backgroundColor: getGuardColor(user.id) }}>
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate tracking-tight">{user.name}</p>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider opacity-70">שומר / מאבטח</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-[10px] text-slate-400 font-bold">TEAM</span>
            <span className="font-mono font-bold text-slate-300 text-sm tracking-[0.2em]">{user.teamCode}</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {GUARD_NAV.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                view === item.id 
                ? "bg-white/10 text-white shadow-lg ring-1 ring-white/10" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}>
              <span className={`text-lg transition-transform ${view === item.id ? "scale-110" : "opacity-70"}`}>{item.icon}</span>
              <span className="flex-1 text-right">{item.label}</span>
              {item.badge && incoming > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
                  {incoming}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-all">
            <span className="opacity-70">🚪</span><span>התנתקות</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMenuOpen(true)} className="lg:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-xl">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1 className="font-bold text-gray-900 tracking-tight text-lg">
              {GUARD_NAV.find(n => n.id === view)?.label || "Guardian"}
            </h1>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/20 shadow-sm"
            style={{ backgroundColor: getGuardColor(user.id) }}>
            {user.name.charAt(0)}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-0">
            {views[view]}
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// GUARD — MY SCHEDULE
// ============================================================
function GuardScheduleView({ user, guards, shifts }) {
  const myShifts = shifts.filter(s => s.assignedGuards.includes(user.id) && s.published);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הסידור שלי</h1>
        <p className="text-gray-500 text-sm">המשמרות שהוקצו לך השבוע</p>
      </div>
      {myShifts.length === 0
        ? <Card><div className="text-center py-12"><div className="text-5xl mb-3">📭</div><p className="text-gray-500">לא שובצת למשמרות עדיין, או הסידור טרם פורסם</p></div></Card>
        : <div className="space-y-3">
            {myShifts.map(s => (
              <div key={s.id} className="rounded-xl p-5 text-white shadow-md relative overflow-hidden" style={{ background: s.color }}>
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-gradient-to-br from-white to-transparent pointer-events-none"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-14 h-14 bg-black/20 rounded-2xl flex items-center justify-center text-3xl shadow-inner backdrop-blur-sm"><span className="opacity-90">⏰</span></div>
                    <div>
                      <h3 className="font-bold text-xl drop-shadow-sm">{formatDateHe(s.date)} <span className="opacity-80 font-medium mx-1">—</span> {s.label}</h3>
                      <p className="text-sm font-medium opacity-90 mt-1">{s.startTime}–{s.endTime} | 📍 {s.location}</p>
                      <div className="flex items-center gap-2 mt-2.5 text-xs flex-wrap">
                        <span className="opacity-80 font-medium whitespace-nowrap">עובד/ת יחד עם:</span>
                        {s.assignedGuards.filter(id => id !== user.id).length === 0 && <span className="opacity-60 whitespace-nowrap">אף אחד</span>}
                        {s.assignedGuards.filter(id => id !== user.id).map(gid => {
                          const g = guards.find(x => x.id === gid) || accounts.find(a => a.id === gid);
                          if (!g) return null;
                          const color = getGuardColor(gid);
                          return (
                            <span key={gid} className="px-2 py-1 rounded-md font-bold whitespace-nowrap text-white shadow-sm"
                              style={{ backgroundColor: color }}>
                              {g.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white text-gray-800 px-3 py-1.5 rounded-full font-bold text-sm shadow-sm flex items-center gap-1.5 self-start shrink-0">
                    <span>✅ מאושר</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
      <Card>
        <h2 className="font-semibold text-gray-800 mb-4">📋 סידור שבועי מלא (מפורסם)</h2>
        {WEEK_DATES.map(date => {
          const dayShifts = shifts.filter(s => s.date === date && s.published);
          if (dayShifts.length === 0) return null;
          return (
            <div key={date} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">{formatDateHe(date)}</p>
              <div className="grid grid-cols-3 gap-3">
                {dayShifts.map(s => {
                  const mine = s.assignedGuards.includes(user.id);
                  return (
                    <div key={s.id} className={`p-3 rounded-xl text-white shadow-sm transition-transform hover:scale-[1.02] ${mine ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-80'}`} style={{ background: s.color }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm bg-black/10 px-2 py-0.5 rounded-lg">{s.label}</span>
                        {mine && <span className="text-[10px] bg-white text-blue-900 px-1.5 py-0.5 rounded-full font-bold shadow-sm">המשמרת שלי</span>}
                      </div>
                      <div className="text-xs font-medium opacity-90 mb-3">{s.startTime}–{s.endTime}</div>
                      <div className="flex flex-wrap gap-1.5">
                      {s.assignedGuards.map(gid => {
                        const g = guards.find(x => x.id === gid) || accounts.find(a => a.id === gid);
                        if (!g) return null;
                        const isMe = gid === user.id;
                        const color = getGuardColor(gid);
                        return (
                          <span key={gid} 
                            className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-sm border ${isMe ? 'bg-white text-gray-900 border-white ring-2 ring-blue-400/50' : 'text-white border-white/20'}`}
                            style={isMe ? {} : { backgroundColor: color }}>
                            {isMe ? "😎 " : ""}{g.name}
                          </span>
                        );
                      })}
                      {s.assignedGuards.length===0 && <span className="text-[10px] bg-black/30 px-2 py-1 rounded-md text-white/90">לא משובץ</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ============================================================
// GUARD — AVAILABILITY
// ============================================================
function GuardAvailView({ user, shifts, availability, setAvailability }) {
  const [weekOffset, setWeekOffset] = useState(1);
  const weekDates = WEEK_DATES.slice(weekOffset * 7, (weekOffset * 7) + 7);
  const getA = sid => availability[`${user.id}-${sid}`];

  const isLocked = useMemo(() => {
    const now = new Date();
    const sunday = new Date(weekDates[0]);
    const deadline = new Date(sunday);
    deadline.setDate(sunday.getDate() - 5); 
    deadline.setHours(14, 0, 0, 0);
    return now > deadline;
  }, [weekOffset]);

  const setA = (sid, val) => {
    if (isLocked) return;
    setAvailability(p => ({...p, [`${user.id}-${sid}`]: val}));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">הגשת זמינות</h1>
          <p className="text-gray-500 text-sm">סמן באיזה משמרות אתה זמין לעבוד</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit border border-gray-200 shadow-inner">
          <button onClick={() => setWeekOffset(0)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekOffset===0 ? "bg-white text-blue-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>השבוע הנוכחי <span className="text-xs opacity-70">({new Date(WEEK_DATES[0]).getDate()}/{new Date(WEEK_DATES[0]).getMonth()+1})</span></button>
          <button onClick={() => setWeekOffset(1)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekOffset===1 ? "bg-white text-blue-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>שבוע הבא <span className="text-xs opacity-70">({new Date(WEEK_DATES[7]).getDate()}/{new Date(WEEK_DATES[7]).getMonth()+1})</span></button>
        </div>
      </div>
      
      {isLocked && (
        <Card className="border-red-200 bg-red-50 py-3 shadow-inner">
          <p className="text-red-600 font-bold text-center">🔒 הגשת הזמינות לשבוע זה נסגרה.</p>
          <p className="text-red-500 text-xs text-center mt-0.5 font-medium">המועד האחרון להגשה היה ביום שלישי בשעה 14:00.</p>
        </Card>
      )}

      <div className="space-y-8">
        {weekDates.map(date => {
          const dayShifts = shifts.filter(s => s.date === date);
          if (dayShifts.length === 0) return null;
          return (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10 py-2">
                <h2 className="text-lg font-bold text-gray-800 bg-white px-3 py-1 rounded-lg shadow-sm border border-gray-100">{DAYS_HE[new Date(date).getDay()]}</h2>
                <span className="text-sm font-bold opacity-60 bg-gray-200 px-2 rounded-md">{formatDateHe(date)}</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dayShifts.map(s => {
                  const cur = getA(s.id);
                  return (
                    <Card key={s.id} className="overflow-hidden border-2 border-transparent transition-all shadow-sm" style={{ borderRightColor: s.color, borderRightWidth: "8px" }}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900" style={{ color: s.color }}>{s.label}</h3>
                          <p className="text-sm font-medium text-gray-500 mt-1">{s.startTime}–{s.endTime} · 📍 {s.location}</p>
                        </div>
                        <div className="flex gap-2">
                          {[
                            {val:"available",   label:"✅ זמין",    act:"bg-green-600 text-white shadow-md",  inact:"bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"},
                            {val:"unavailable", label:"❌ לא זמין", act:"bg-red-600 text-white shadow-md",     inact:"bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"},
                          ].map(({val, label, act, inact}) => (
                            <button key={val} disabled={isLocked} onClick={() => setA(s.id, typeof cur === 'string' ? {status:val} : { ...cur, status: val })}
                              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${(cur?.status||cur)===val ? act : inact} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <input type="text" placeholder="הערה למשמרת (אופציונלי)..." disabled={isLocked}
                          value={cur?.comment || ""} 
                          onChange={e => setA(s.id, { status: cur?.status || cur || "", comment: e.target.value })}
                          className={`w-full text-sm bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:ring-2 focus:ring-blue-400 placeholder-gray-400 transition-all ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// GUARD — SWAP REQUESTS
// ============================================================
function GuardSwapsView({ user, guards, shifts, swapRequests, setSwapRequests }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shiftId:"", toGuard:"", message:"" });

  const myShifts = shifts.filter(s => s.assignedGuards.includes(user.id));
  const sent     = swapRequests.filter(r => r.fromGuard === user.id);
  const incoming = swapRequests.filter(r => r.toGuard === user.id);

  const submit = () => {
    if (!form.shiftId || !form.toGuard) return;
    setSwapRequests(p => [...p, {
      id:`sr${Date.now()}`, fromGuard: user.id, toGuard: form.toGuard,
      shiftId: form.shiftId, status:"pending", message: form.message,
      createdAt: new Date().toISOString(), supervisorCode: user.teamCode,
    }]);
    setShowForm(false);
    setForm({ shiftId:"", toGuard:"", message:"" });
  };

  const respond = (id, accept) =>
    setSwapRequests(p => p.map(r => r.id===id ? {...r, status: accept?"approved":"rejected"} : r));

  const gName = id => guards.find(g => g.id===id)?.name || id;
  const getS  = id => shifts.find(s => s.id===id);
  const stClr = { pending:"yellow", approved:"green", rejected:"red" };
  const stLbl = { pending:"ממתין", approved:"אושר", rejected:"נדחה" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בקשות החלפת משמרות</h1>
          <p className="text-gray-500 text-sm">שלח וקבל בקשות להחלפת משמרות</p>
        </div>
        <Btn onClick={() => setShowForm(true)}>+ בקשה חדשה</Btn>
      </div>

      {showForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <h3 className="font-semibold mb-4 text-blue-900">➕ בקשת החלפה חדשה</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-600 mb-1">המשמרת שלי</label>
              <select value={form.shiftId} onChange={e => setForm(p => ({...p, shiftId: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">בחר משמרת</option>
                {myShifts.map(s => <option key={s.id} value={s.id}>{formatDateHe(s.date)} — {s.label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm text-gray-600 mb-1">לשלוח ל</label>
              <select value={form.toGuard} onChange={e => setForm(p => ({...p, toGuard: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">בחר שומר</option>
                {guards.filter(g => g.id !== user.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="block text-sm text-gray-600 mb-1">הסבר (אופציונלי)</label>
              <input type="text" value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))} placeholder="סיבה לבקשה..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Btn onClick={submit}>שלח בקשה</Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>ביטול</Btn>
          </div>
        </Card>
      )}

      {incoming.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">📩 בקשות נכנסות</h2>
          <div className="space-y-3">
            {incoming.map(r => {
              const s = getS(r.shiftId);
              return (
                <Card key={r.id} className={r.status==="pending" ? "border-amber-200 bg-amber-50/30" : ""}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{gName(r.fromGuard)} מבקש להחליף</p>
                      {s && <p className="text-sm text-gray-500 mt-0.5">{formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}</p>}
                      {r.message && <p className="text-sm text-gray-600 mt-1">💬 {r.message}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge color={stClr[r.status]}>{stLbl[r.status]}</Badge>
                      {r.status==="pending" && (
                        <>
                          <Btn variant="success" size="sm" onClick={() => respond(r.id, true)}>קבל</Btn>
                          <Btn variant="danger"  size="sm" onClick={() => respond(r.id, false)}>דחה</Btn>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-800 mb-3">📤 הבקשות שלי</h2>
        {sent.length === 0
          ? <Card><p className="text-center text-gray-400 py-8">לא שלחת בקשות החלפה</p></Card>
          : <div className="space-y-3">
              {sent.map(r => {
                const s = getS(r.shiftId);
                return (
                  <Card key={r.id}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">בקשה ל{gName(r.toGuard)}</p>
                        {s && <p className="text-sm text-gray-500 mt-0.5">{formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}</p>}
                        {r.message && <p className="text-sm text-gray-600 mt-1">💬 {r.message}</p>}
                      </div>
                      <Badge color={stClr[r.status]}>{stLbl[r.status]}</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

const WeekNavigator = ({ offset, setOffset, dates }) => {
  return (
    <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
      <button onClick={() => setOffset(offset + 1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600" title="שבוע הבא">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div className="px-4 text-sm font-bold text-gray-800 tracking-wide select-none min-w-[170px] text-center">
        {formatDateHe(dates[0])} — {formatDateHe(dates[6])}
      </div>
      <button onClick={() => setOffset(offset - 1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600" title="שבוע קודם">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <button onClick={() => setOffset(0)} className={`ml-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${offset===0?'bg-blue-100 text-blue-700 shadow-sm':'bg-gray-50 text-gray-600 hover:bg-gray-200'}`}>השבוע</button>
    </div>
  );
};

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  
  // Persisted States (Local fallbacks)
  const [accounts, setAccounts]       = useState(() => {
    const saved = localStorage.getItem("gs_accounts");
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });
  const [guards, setGuards]           = useState(() => {
    const saved = localStorage.getItem("gs_guards");
    return saved ? JSON.parse(saved) : INITIAL_GUARDS;
  });
  const [shifts, setShifts]           = useState(() => {
    const saved = localStorage.getItem("gs_shifts");
    return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
  });
  const [availability, setAvailability] = useState(() => {
    const saved = localStorage.getItem("gs_availability");
    return saved ? JSON.parse(saved) : INITIAL_AVAILABILITY;
  });
  const [swapRequests, setSwapRequests] = useState(() => {
    const saved = localStorage.getItem("gs_swapRequests");
    return saved ? JSON.parse(saved) : INITIAL_SWAP_REQUESTS;
  });
  const [tasks, setTasks]             = useState(() => {
    const saved = localStorage.getItem("gs_tasks");
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  // Supabase Data Sync
  useEffect(() => {
    async function loadCloudData() {
      setLoading(true);
      try {
        const { data: dbShifts } = await supabase.from('shifts').select('*, assignments(guard_id)');
        if (dbShifts?.length) {
          setShifts(dbShifts.map(s => ({
            ...s,
            assignedGuards: s.assignments?.map(a => a.guard_id) || []
          })));
        }
        
        const { data: dbProfiles } = await supabase.from('profiles').select('*');
        if (dbProfiles?.length) {
          const dbGuards = dbProfiles.filter(p => p.role === 'guard').map(p => ({
            id: p.id, name: p.full_name, phone: p.phone, teamCode: p.team_code
          }));
          const dbSups = dbProfiles.filter(p => p.role === 'supervisor').map(p => ({
            id: p.id, name: p.full_name, type: 'supervisor', teamCode: p.team_code, email: `${p.id}@cloud.com` 
          }));
          if (dbGuards.length) setGuards(dbGuards);
          if (dbSups.length) setAccounts(prev => {
            const others = prev.filter(a => !dbSups.find(s => s.id === a.id));
            return [...others, ...dbSups];
          });
        }
      } catch (e) {
        console.error("Cloud Sync Error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadCloudData();
  }, []);

  // Sync back to Cloud on change (Debounced / Side effect)
  useEffect(() => {
    if (user && user.type === 'supervisor') {
      // Automatic sync logic can go here
    }
  }, [shifts, guards, accounts]);

  // Sync to Storage
  useEffect(() => { localStorage.setItem("gs_accounts", JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem("gs_guards", JSON.stringify(guards)); }, [guards]);
  useEffect(() => { localStorage.setItem("gs_shifts", JSON.stringify(shifts)); }, [shifts]);
  useEffect(() => { localStorage.setItem("gs_availability", JSON.stringify(availability)); }, [availability]);
  useEffect(() => { localStorage.setItem("gs_swapRequests", JSON.stringify(swapRequests)); }, [swapRequests]);
  useEffect(() => { localStorage.setItem("gs_tasks", JSON.stringify(tasks)); }, [tasks]);

  const [weekOffset, setWeekOffset]   = useState(0);
  const weekDates = useMemo(() => {
    const today = new Date("2026-03-31T12:00:00");
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day + (weekOffset * 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }, [weekOffset]);

  // Supervisor registers → new account created
  const handleRegister = async (newAcc) => {
    setAccounts(p => [...p, newAcc]);
    try {
      await supabase.from('profiles').upsert({
        id: newAcc.id,
        full_name: newAcc.name,
        role: 'supervisor',
        team_code: newAcc.teamCode
      });
    } catch (e) { console.error("Cloud Reg Error:", e); }
  };

  // Guard joins with team code + name
  const handleGuardJoin = async (teamCode, name) => {
    // Find or create guard profile
    let guard = guards.find(g => g.teamCode === teamCode && g.name.toLowerCase() === name.toLowerCase());
    if (!guard) {
      const newId = `g${Date.now()}`;
      guard = { id: newId, name, phone: "—", teamCode };
      setGuards(p => [...p, guard]);
      try {
        await supabase.from('profiles').insert({
          id: newId, full_name: name, role: 'guard', team_code: teamCode
        });
      } catch (e) { console.error("Cloud Join Error:", e); }
    }
    setUser({ ...guard, type: "guard" });
  };

  if (!user) {
    return (
      <AuthPage
        accounts={accounts}
        guards={guards}
        onLogin={setUser}
        onRegister={handleRegister}
        onGuardJoin={handleGuardJoin}
      />
    );
  }

  const shared = {
    guards, shifts, availability, swapRequests, tasks,
    setGuards, setShifts, setAvailability, setSwapRequests, setTasks,
    onLogout: () => setUser(null),
    weekOffset, setWeekOffset, weekDates
  };

  return user.type === "supervisor"
    ? <SupervisorApp user={user} {...shared} />
    : <GuardApp     user={user} accounts={accounts} {...shared} />;
}
