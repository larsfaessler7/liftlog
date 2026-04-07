"use client";
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const BLOCKS = ["A", "B", "C", "D", "E", "F"];
const BLOCK_COLORS: Record<string, string> = {
  A: "#007AFF", B: "#34C759", C: "#FF2D55", D: "#FF9500", E: "#AF52DE", F: "#5AC8FA",
};

type Set = { done: boolean; weight: string; reps: string };
type Exercise = { block: string; name: string; sets: number; reps: string; noWeight?: boolean };
type Program = { id: string; name: string; day: string; exercises: Exercise[] };
type LogExercise = { block: string; name: string; sets: { weight: string; reps: string }[]; noWeight?: boolean };
type Log = { id: string; name: string; date: string; exercises: LogExercise[] };
type ActiveEx = { block: string; name: string; sets: Set[]; noWeight?: boolean };
type ActiveWO = { name: string; date: string; exercises: ActiveEx[] };
type User = { id: string; email: string };

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const calcVol = (log: Log) => log.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);

function BlockDot({ block, size = 32 }: { block: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: BLOCK_COLORS[block], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {block}
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [screen, setScreen] = useState("home");
  const [showProgModal, setShowProgModal] = useState(false);
  const [showWOModal, setShowWOModal] = useState(false);
  const [editingProg, setEditingProg] = useState<Program | null>(null);
  const [progName, setProgName] = useState("");
  const [progDay, setProgDay] = useState("");
  const [progExs, setProgExs] = useState<Exercise[]>([{ block: "A", name: "", sets: 3, reps: "8", noWeight: false }]);
  const [activeWO, setActiveWO] = useState<ActiveWO | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email || "" });
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email || "" });
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) { loadPrograms(); loadLogs(); } }, [user]);

  const loadPrograms = async () => {
    const { data } = await supabase.from("programs").select("*").order("created_at");
    if (data) setPrograms(data.map(p => ({ id: p.id, name: p.name, day: p.day || "", exercises: p.exercises })));
  };

  const loadLogs = async () => {
    const { data } = await supabase.from("logs").select("*").order("date");
    if (data) setLogs(data.map(l => ({ id: l.id, name: l.name, date: l.date, exercises: l.exercises })));
  };

  const handleAuth = async () => {
    setAuthError(""); setAuthSubmitting(true);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
      else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setUser({ id: session.user.id, email: authEmail });
        else setAuthError("Check your email to confirm your account.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
    }
    setAuthSubmitting(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null); setPrograms([]); setLogs([]); };

  const saveProgram = async () => {
    const exs = progExs.filter(e => e.name.trim()).sort((a, b) => a.block.localeCompare(b.block));
    if (!progName.trim() || !exs.length) return;
    if (editingProg) {
      await supabase.from("programs").update({ name: progName.trim(), day: progDay.trim(), exercises: exs }).eq("id", editingProg.id);
    } else {
      await supabase.from("programs").insert({ name: progName.trim(), day: progDay.trim(), exercises: exs, user_id: user!.id });
    }
    await loadPrograms(); setShowProgModal(false);
  };

  const deleteProg = async () => {
    if (!editingProg) return;
    await supabase.from("programs").delete().eq("id", editingProg.id);
    await loadPrograms(); setShowProgModal(false);
  };

  const openNewProg = () => { setEditingProg(null); setProgName(""); setProgDay(""); setProgExs([{ block: "A", name: "", sets: 3, reps: "8", noWeight: false }]); setShowProgModal(true); };
  const openEditProg = (p: Program) => { setEditingProg(p); setProgName(p.name); setProgDay(p.day); setProgExs([...p.exercises]); setShowProgModal(true); };

  const startWO = (prog: Program) => {
    setActiveWO({
      name: prog.name, date: today(),
      exercises: prog.exercises.map(e => ({
        block: e.block, name: e.name, noWeight: e.noWeight || false,
        sets: Array.from({ length: e.sets }, () => ({ done: false, weight: "", reps: e.noWeight ? "1" : e.reps }))
      }))
    });
    setShowWOModal(true);
  };

  const getLastSets = (name: string) => {
    for (let i = logs.length - 1; i >= 0; i--) {
      const ex = logs[i].exercises.find(e => e.name === name);
      if (ex) return ex.sets;
    }
    return null;
  };

  const finishWO = async () => {
    if (!activeWO) return;
    const logExs = activeWO.exercises.map(e => ({
      block: e.block, name: e.name, noWeight: e.noWeight,
      sets: e.sets.filter(s => s.done).map(s => ({ weight: s.weight || "0", reps: s.reps || "0" }))
    })).filter(e => e.sets.length > 0);
    if (logExs.length > 0) {
      await supabase.from("logs").insert({ name: activeWO.name, date: activeWO.date, exercises: logExs, user_id: user!.id });
      await loadLogs();
    }
    setActiveWO(null); setShowWOModal(false);
  };

  const updateSet = (ei: number, si: number, field: "weight" | "reps" | "done", val: string | boolean) => {
    if (!activeWO) return;
    setActiveWO({ ...activeWO, exercises: activeWO.exercises.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, [field]: val }) }) });
  };

  const completeAllSets = (ei: number) => {
    if (!activeWO) return;
    setActiveWO({ ...activeWO, exercises: activeWO.exercises.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map(s => ({ ...s, done: true })) }) });
  };

  const addSet = (ei: number) => {
    if (!activeWO) return;
    setActiveWO({ ...activeWO, exercises: activeWO.exercises.map((e, i) => i !== ei ? e : { ...e, sets: [...e.sets, { done: false, weight: "", reps: "" }] }) });
  };

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = logs.filter(l => new Date(l.date + "T12:00:00") >= weekStart).length;
  const todayVol = logs.filter(l => l.date === today()).reduce((a, l) => a + calcVol(l), 0);
  const prs: Record<string, { w: number; reps: string; date: string }> = {};
  logs.forEach(l => l.exercises.forEach(e => e.sets.forEach(s => {
    const w = parseFloat(s.weight) || 0;
    if (w > 0 && (!prs[e.name] || w > prs[e.name].w)) prs[e.name] = { w, reps: s.reps, date: l.date };
  })));

  const groupByBlock = (exs: ActiveEx[]) => {
    const blocks: Record<string, { ex: ActiveEx; ei: number }[]> = {};
    exs.forEach((e, ei) => { if (!blocks[e.block]) blocks[e.block] = []; blocks[e.block].push({ ex: e, ei }); });
    return blocks;
  };

  const d = { bg: "#0C0C0E", card: "#1C1C1E", cardBorder: "rgba(255,255,255,0.08)", input: "#2C2C2E", inputAlt: "#3A3A3C", textPrimary: "#FFFFFF", textSecondary: "#8E8E93", separator: "rgba(255,255,255,0.06)" };
  const cardStyle = { background: d.card, borderRadius: 12, border: `0.5px solid ${d.cardBorder}`, overflow: "hidden" as const };
  const rowStyle = { display: "flex" as const, alignItems: "center" as const, padding: "13px 16px", borderBottom: `0.5px solid ${d.separator}`, cursor: "pointer" as const };
  const inputStyle = { width: "100%", padding: "12px 14px", background: d.input, border: `0.5px solid ${d.cardBorder}`, borderRadius: 10, fontSize: 15, color: d.textPrimary, fontFamily: "inherit" };
  const labelStyle = { display: "block" as const, fontSize: 13, fontWeight: 500, color: d.textSecondary, marginBottom: 5 };
  const sectionLabel = { fontSize: 12, fontWeight: 500, color: d.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8, padding: "0 4px" };
  const font = { fontFamily: "-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" };

  if (authLoading) return (
    <div style={{ ...font, maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: d.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: d.textSecondary, fontSize: 15 }}>Loading...</p>
    </div>
  );

  if (!user) return (
    <div style={{ ...font, maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: d.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: d.textPrimary, letterSpacing: -1, margin: 0 }}>LiftLog</h1>
        <p style={{ fontSize: 15, color: d.textSecondary, marginTop: 8 }}>Track your training</p>
      </div>
      <div style={{ width: "100%", background: d.card, borderRadius: 16, border: `0.5px solid ${d.cardBorder}`, padding: 24 }}>
        <div style={{ display: "flex", marginBottom: 24, background: d.input, borderRadius: 10, padding: 3 }}>
          {(["login", "signup"] as const).map(mode => (
            <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: authMode === mode ? "#007AFF" : "transparent", color: authMode === mode ? "white" : d.textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {mode === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}><label style={labelStyle}>Email</label><input style={inputStyle} type="email" placeholder="your@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
        <div style={{ marginBottom: 20 }}><label style={labelStyle}>Password</label><input style={inputStyle} type="password" placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} /></div>
        {authError && <p style={{ fontSize: 13, color: "#FF453A", marginBottom: 12, textAlign: "center" }}>{authError}</p>}
        <button onClick={handleAuth} disabled={authSubmitting} style={{ width: "100%", padding: 14, background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: authSubmitting ? 0.6 : 1, fontFamily: "inherit" }}>
          {authSubmitting ? "..." : authMode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ ...font, maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: d.bg, paddingBottom: 80, position: "relative" }}>

      {/* HOME */}
      {screen === "home" && (
        <div>
          <div style={{ background: d.card, padding: "56px 20px 14px", borderBottom: `0.5px solid ${d.cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div><h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: d.textPrimary, margin: 0 }}>LiftLog</h1>
              <p style={{ fontSize: 13, color: d.textSecondary, marginTop: 2 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p></div>
              <button onClick={handleSignOut} style={{ background: "none", border: "none", color: d.textSecondary, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
            </div>
          </div>
          <div style={{ margin: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ ...cardStyle, padding: 16 }}><p style={{ fontSize: 12, color: d.textSecondary, margin: "0 0 4px" }}>Sessions this week</p><p style={{ fontSize: 22, fontWeight: 600, color: d.textPrimary, margin: 0 }}>{weekSessions}</p></div>
            <div style={{ ...cardStyle, padding: 16 }}><p style={{ fontSize: 12, color: d.textSecondary, margin: "0 0 4px" }}>Volume today</p><p style={{ fontSize: 22, fontWeight: 600, color: d.textPrimary, margin: 0 }}>{Math.round(todayVol)} <span style={{ fontSize: 13, fontWeight: 400, color: d.textSecondary }}>kg</span></p></div>
          </div>
          <div style={{ margin: "16px 16px 0" }}>
            <p style={sectionLabel}>Start workout</p>
            <div style={cardStyle}>
              {programs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: d.textSecondary, fontSize: 14 }}>No programs yet</div> :
                programs.map((p, i) => (
                  <div key={p.id} style={{ ...rowStyle, borderBottom: i === programs.length - 1 ? "none" : `0.5px solid ${d.separator}` }} onClick={() => startWO(p)}>
                    <div style={{ display: "flex", gap: 5, marginRight: 10 }}>{[...new Set(p.exercises.map(e => e.block))].map(b => <BlockDot key={b} block={b} size={22} />)}</div>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 15, fontWeight: 500, color: d.textPrimary, margin: 0 }}>{p.name}</p><p style={{ fontSize: 13, color: d.textSecondary, margin: "1px 0 0" }}>{p.day || "Any day"} · {p.exercises.length} exercises</p></div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#007AFF", background: "rgba(0,122,255,0.15)", padding: "4px 12px", borderRadius: 20 }}>Start</span>
                  </div>
                ))}
            </div>
          </div>
          <div style={{ margin: "16px 16px 0" }}>
            <p style={sectionLabel}>Recent</p>
            <div style={cardStyle}>
              {logs.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: d.textSecondary, fontSize: 14 }}>No sessions yet</div> :
                logs.slice(-4).reverse().map((l, i, arr) => (
                  <div key={l.id} style={{ ...rowStyle, borderBottom: i === arr.length - 1 ? "none" : `0.5px solid ${d.separator}` }}>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 15, fontWeight: 500, color: d.textPrimary, margin: 0 }}>{l.name}</p><p style={{ fontSize: 13, color: d.textSecondary, margin: "1px 0 0" }}>{fmtDate(l.date)} · {Math.round(calcVol(l))} kg</p></div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PROGRAMS */}
      {screen === "programs" && (
        <div>
          <div style={{ background: d.card, padding: "56px 20px 14px", borderBottom: `0.5px solid ${d.cardBorder}` }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: d.textPrimary, margin: 0 }}>Programs</h1>
          </div>
          <div style={{ margin: "16px 16px 0" }}>
            <div style={cardStyle}>
              {programs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: d.textSecondary, fontSize: 14 }}>Tap + to create your first program</div> :
                programs.map((p, i) => (
                  <div key={p.id} style={{ ...rowStyle, borderBottom: i === programs.length - 1 ? "none" : `0.5px solid ${d.separator}` }} onClick={() => openEditProg(p)}>
                    <div style={{ display: "flex", gap: 5, marginRight: 10 }}>{[...new Set(p.exercises.map(e => e.block))].map(b => <BlockDot key={b} block={b} size={22} />)}</div>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 15, fontWeight: 500, color: d.textPrimary, margin: 0 }}>{p.name}</p><p style={{ fontSize: 13, color: d.textSecondary, margin: "1px 0 0" }}>{p.day || "Any day"} · {p.exercises.length} exercises</p></div>
                    <span style={{ color: d.textSecondary, fontSize: 18, opacity: 0.4 }}>›</span>
                  </div>
                ))}
            </div>
          </div>
          <button onClick={openNewProg} style={{ position: "fixed", bottom: 84, right: 16, width: 52, height: 52, background: "#007AFF", borderRadius: "50%", border: "none", color: "white", fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,122,255,0.4)" }}>+</button>
        </div>
      )}

      {/* HISTORY */}
      {screen === "history" && (
        <div>
          <div style={{ background: d.card, padding: "56px 20px 14px", borderBottom: `0.5px solid ${d.cardBorder}` }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: d.textPrimary, margin: 0 }}>History</h1>
          </div>
          <div style={{ margin: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {logs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: d.textSecondary, fontSize: 14 }}>No sessions yet</div> :
              logs.slice().reverse().map(l => {
                const blocks: Record<string, LogExercise[]> = {};
                l.exercises.forEach(e => { if (!blocks[e.block]) blocks[e.block] = []; blocks[e.block].push(e); });
                return (
                  <div key={l.id} style={cardStyle}>
                    <div style={{ padding: "12px 16px", borderBottom: `0.5px solid ${d.separator}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: d.textPrimary }}>{l.name}</span>
                      <span style={{ fontSize: 13, color: d.textSecondary }}>{fmtDate(l.date)} · {Math.round(calcVol(l))} kg</span>
                    </div>
                    {Object.entries(blocks).map(([b, exs]) => (
                      <div key={b} style={{ padding: "10px 16px", borderBottom: `0.5px solid ${d.separator}`, display: "flex", gap: 12 }}>
                        <BlockDot block={b} size={26} />
                        <div>{exs.map(e => (<div key={e.name} style={{ marginBottom: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: d.textPrimary, margin: 0 }}>{e.name}</p>
                          <p style={{ fontSize: 12, color: d.textSecondary, margin: "2px 0 0" }}>
                            {e.noWeight ? `${e.sets.length} sets completed` : e.sets.filter(s => s.weight).map(s => `${s.weight}kg×${s.reps}`).join(" / ")}
                          </p>
                        </div>))}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* RECORDS */}
      {screen === "pr" && (
        <div>
          <div style={{ background: d.card, padding: "56px 20px 14px", borderBottom: `0.5px solid ${d.cardBorder}` }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: d.textPrimary, margin: 0 }}>Records</h1>
          </div>
          <div style={{ margin: "16px 16px 0" }}>
            <div style={cardStyle}>
              {Object.keys(prs).length === 0 ? <div style={{ textAlign: "center", padding: 40, color: d.textSecondary, fontSize: 14 }}>Log weights to track PRs</div> :
                Object.entries(prs).sort((a, b) => b[1].w - a[1].w).map(([name, pr], i, arr) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: i === arr.length - 1 ? "none" : `0.5px solid ${d.separator}` }}>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: d.textPrimary }}>{name}</div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 17, fontWeight: 600, color: d.textPrimary, margin: 0 }}>{pr.w} kg <span style={{ fontSize: 10, fontWeight: 700, color: "#FF9500", background: "rgba(255,149,0,0.2)", padding: "2px 6px", borderRadius: 6 }}>PR</span></p>
                      <p style={{ fontSize: 12, color: d.textSecondary, margin: "2px 0 0" }}>×{pr.reps} · {fmtDate(pr.date)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(18,18,20,0.95)", backdropFilter: "blur(20px)", borderTop: `0.5px solid ${d.cardBorder}`, display: "flex", paddingBottom: 20, paddingTop: 8, zIndex: 50 }}>
        {[["home", "🏠", "Home"], ["programs", "📋", "Programs"], ["history", "📊", "History"], ["pr", "🏆", "Records"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setScreen(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, color: screen === id ? "#007AFF" : d.textSecondary }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODAL: Program Editor */}
      {showProgModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowProgModal(false)}>
          <div style={{ background: "#1C1C1E", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", paddingBottom: 40 }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#3A3A3C", borderRadius: 2, margin: "12px auto 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: `0.5px solid ${d.separator}`, position: "sticky", top: 0, background: "#1C1C1E", zIndex: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: d.textPrimary }}>{editingProg ? "Edit program" : "New program"}</span>
              <button onClick={() => setShowProgModal(false)} style={{ background: "#2C2C2E", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: d.textSecondary, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Program name</label><input style={inputStyle} placeholder="e.g. Push Day" value={progName} onChange={e => setProgName(e.target.value)} /></div>
              <div style={{ marginBottom: 14 }}><label style={labelStyle}>Day (optional)</label><input style={inputStyle} placeholder="e.g. Monday" value={progDay} onChange={e => setProgDay(e.target.value)} /></div>
              <div style={{ marginBottom: 8 }}>
                {progExs.map((ex, i) => (
                  <div key={i} style={{ background: "#2C2C2E", borderRadius: 10, padding: 12, marginBottom: 10, position: "relative" }}>
                    <button onClick={() => setProgExs(progExs.filter((_, j) => j !== i))} style={{ position: "absolute", top: 8, right: 8, color: "#FF453A", fontSize: 18, background: "transparent", border: "none", cursor: "pointer" }}>×</button>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <div style={{ flex: "0 0 60px" }}><label style={labelStyle}>Block</label>
                        <select style={{ ...inputStyle, background: d.inputAlt }} value={ex.block} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, block: e.target.value } : x))}>
                          {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: "1 1 120px" }}><label style={labelStyle}>Exercise</label><input style={{ ...inputStyle, background: d.inputAlt }} placeholder="e.g. Bench Press" value={ex.name} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                      {!ex.noWeight && <>
                        <div style={{ flex: "0 0 52px" }}><label style={labelStyle}>Sets</label><input style={{ ...inputStyle, background: d.inputAlt }} type="number" min={1} max={10} value={ex.sets} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, sets: parseInt(e.target.value) || 3 } : x))} /></div>
                        <div style={{ flex: "0 0 52px" }}><label style={labelStyle}>Reps</label><input style={{ ...inputStyle, background: d.inputAlt }} placeholder="8" value={ex.reps} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} /></div>
                      </>}
                      {ex.noWeight && <>
                        <div style={{ flex: "0 0 52px" }}><label style={labelStyle}>Sets</label><input style={{ ...inputStyle, background: d.inputAlt }} type="number" min={1} max={10} value={ex.sets} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, sets: parseInt(e.target.value) || 3 } : x))} /></div>
                      </>}
                    </div>
                    {/* No weight toggle */}
                    <div onClick={() => setProgExs(progExs.map((x, j) => j === i ? { ...x, noWeight: !x.noWeight } : x))}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: d.inputAlt, borderRadius: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: 13, color: d.textPrimary }}>Complete only (no weight)</span>
                      <div style={{ width: 44, height: 26, borderRadius: 13, background: ex.noWeight ? "#34C759" : "#3A3A3C", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ position: "absolute", top: 3, left: ex.noWeight ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setProgExs([...progExs, { block: "A", name: "", sets: 3, reps: "8", noWeight: false }])} style={{ width: "100%", padding: 13, background: "transparent", color: "#007AFF", border: `0.5px solid ${d.cardBorder}`, borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>+ Add exercise</button>
              <button onClick={saveProgram} style={{ width: "100%", padding: 14, background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" }}>Save program</button>
              {editingProg && <button onClick={deleteProg} style={{ width: "100%", padding: 13, background: "transparent", color: "#FF453A", border: `0.5px solid ${d.cardBorder}`, borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete program</button>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Active Workout */}
      {showWOModal && activeWO && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", background: d.bg }}>
          <div style={{ background: "#007AFF", padding: "52px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><h1 style={{ fontSize: 24, fontWeight: 700, color: "white", letterSpacing: -0.3, margin: 0 }}>{activeWO.name}</h1><p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{activeWO.exercises.length} exercises</p></div>
              <button onClick={() => setShowWOModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
            </div>
          </div>
          <div style={{ paddingBottom: 24 }}>
            {Object.entries(groupByBlock(activeWO.exercises)).map(([b, items]) => (
              <div key={b} style={{ margin: "12px 16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><BlockDot block={b} /><span style={{ fontSize: 16, fontWeight: 600, color: d.textPrimary }}>Block {b}</span></div>
                {items.map(({ ex, ei }) => {
                  const last = getLastSets(ex.name);
                  const allDone = ex.sets.every(s => s.done);
                  return (
                    <div key={ei} style={{ ...cardStyle, marginBottom: 8 }}>
                      <div style={{ padding: "11px 14px", background: "#2C2C2E", borderBottom: `0.5px solid ${d.separator}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: d.textPrimary }}>{ex.name}</span>
                        {ex.noWeight
                          ? <span style={{ fontSize: 12, color: d.textSecondary }}>{ex.sets.length} sets</span>
                          : <span style={{ fontSize: 12, color: d.textSecondary }}>{last ? `Last: ${last.slice(0, 2).map(s => `${s.weight}×${s.reps}`).join(", ")}` : "No history"}</span>
                        }
                      </div>

                      {ex.noWeight ? (
                        /* Complete-only view */
                        <div style={{ padding: "16px 14px" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                            {ex.sets.map((set, si) => (
                              <div key={si} onClick={() => updateSet(ei, si, "done", !set.done)}
                                style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${set.done ? "#34C759" : "#3A3A3C"}`, background: set.done ? "rgba(52,199,89,0.15)" : "transparent", color: set.done ? "#34C759" : d.textSecondary }}>
                                {set.done ? "✓" : si + 1}
                              </div>
                            ))}
                          </div>
                          <button onClick={() => completeAllSets(ei)}
                            style={{ width: "100%", padding: "12px", background: allDone ? "rgba(52,199,89,0.15)" : "#2C2C2E", border: `1.5px solid ${allDone ? "#34C759" : "#3A3A3C"}`, borderRadius: 10, color: allDone ? "#34C759" : d.textPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            {allDone ? "✓ Completed" : "Complete all sets"}
                          </button>
                        </div>
                      ) : (
                        /* Weight + reps view */
                        <div style={{ padding: "8px 12px 4px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 32px", gap: 6, marginBottom: 4 }}>
                            <div /><div style={{ textAlign: "center", fontSize: 11, color: d.textSecondary }}>kg</div><div style={{ textAlign: "center", fontSize: 11, color: d.textSecondary }}>reps</div><div />
                          </div>
                          {ex.sets.map((set, si) => (
                            <div key={si} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 32px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                              <div onClick={() => updateSet(ei, si, "done", !set.done)} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${set.done ? "#34C759" : "#3A3A3C"}`, background: set.done ? "#34C759" : "transparent", color: set.done ? "white" : d.textSecondary }}>{set.done ? "✓" : si + 1}</div>
                              <input style={{ padding: "8px 6px", background: "#2C2C2E", border: `0.5px solid ${d.cardBorder}`, borderRadius: 8, fontSize: 15, color: d.textPrimary, fontFamily: "inherit", textAlign: "center", width: "100%" }} placeholder={last?.[si]?.weight || "--"} value={set.weight} onChange={e => updateSet(ei, si, "weight", e.target.value)} />
                              <input style={{ padding: "8px 6px", background: "#2C2C2E", border: `0.5px solid ${d.cardBorder}`, borderRadius: 8, fontSize: 15, color: d.textPrimary, fontFamily: "inherit", textAlign: "center", width: "100%" }} placeholder={last?.[si]?.reps || "--"} value={set.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)} />
                              <div />
                            </div>
                          ))}
                          <button onClick={() => addSet(ei)} style={{ color: "#007AFF", fontSize: 13, fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>+ Set</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ margin: "16px 16px 0" }}><button onClick={finishWO} style={{ width: "100%", padding: 14, background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Finish & save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}