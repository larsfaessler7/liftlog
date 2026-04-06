"use client";
import { useState, useEffect } from "react";

const BLOCKS = ["A", "B", "C", "D", "E", "F"];
const BLOCK_COLORS: Record<string, string> = {
  A: "#007AFF", B: "#34C759", C: "#FF2D55", D: "#FF9500", E: "#AF52DE", F: "#5AC8FA",
};

type Set = { done: boolean; weight: string; reps: string };
type Exercise = { block: string; name: string; sets: number; reps: string };
type Program = { id: string; name: string; day: string; exercises: Exercise[] };
type LogExercise = { block: string; name: string; sets: { weight: string; reps: string }[] };
type Log = { id: string; name: string; date: string; exercises: LogExercise[] };
type ActiveEx = { block: string; name: string; sets: Set[] };
type ActiveWO = { name: string; date: string; exercises: ActiveEx[] };

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
  const [programs, setPrograms] = useState<Program[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [screen, setScreen] = useState("home");
  const [showProgModal, setShowProgModal] = useState(false);
  const [showWOModal, setShowWOModal] = useState(false);
  const [editingProg, setEditingProg] = useState<Program | null>(null);
  const [progName, setProgName] = useState("");
  const [progDay, setProgDay] = useState("");
  const [progExs, setProgExs] = useState<Exercise[]>([{ block: "A", name: "", sets: 3, reps: "8" }]);
  const [activeWO, setActiveWO] = useState<ActiveWO | null>(null);

  useEffect(() => {
    const p = localStorage.getItem("ll3_progs");
    const l = localStorage.getItem("ll3_logs");
    if (p) setPrograms(JSON.parse(p));
    else {
      const seed: Program[] = [
        { id: "p1", name: "Push Day", day: "Monday", exercises: [{ block: "A", name: "Barbell Bench Press", sets: 5, reps: "5" }, { block: "A", name: "TRX Row", sets: 3, reps: "15" }, { block: "B", name: "Goblet Split Squat", sets: 3, reps: "10" }, { block: "B", name: "Nordic Hamstring Curl", sets: 3, reps: "6" }, { block: "C", name: "Pull Up", sets: 4, reps: "4" }, { block: "C", name: "Cable Tricep Pushdown", sets: 3, reps: "15" }] },
        { id: "p2", name: "Pull Day", day: "Wednesday", exercises: [{ block: "A", name: "Hex Bar Deadlift", sets: 4, reps: "5" }, { block: "A", name: "Hanging Knee Tucks", sets: 3, reps: "10" }, { block: "B", name: "Dumbbell Incline Row", sets: 4, reps: "10" }, { block: "B", name: "Box Jump to Depth Drop", sets: 4, reps: "4" }, { block: "C", name: "Dumbbell Bicep Curl", sets: 3, reps: "15" }] },
        { id: "p3", name: "Leg Day", day: "Friday", exercises: [{ block: "A", name: "Dumbbell Squat Jumps", sets: 4, reps: "4" }, { block: "B", name: "Barbell Back Squat", sets: 5, reps: "5" }, { block: "B", name: "GHD Side Bend", sets: 3, reps: "12" }, { block: "C", name: "Kettlebell RDL", sets: 3, reps: "15" }, { block: "D", name: "Dumbbell Lateral Squat", sets: 3, reps: "12" }] },
      ];
      setPrograms(seed);
      localStorage.setItem("ll3_progs", JSON.stringify(seed));
    }
    if (l) setLogs(JSON.parse(l));
  }, []);

  const savePrograms = (p: Program[]) => { setPrograms(p); localStorage.setItem("ll3_progs", JSON.stringify(p)); };
  const saveLogs = (l: Log[]) => { setLogs(l); localStorage.setItem("ll3_logs", JSON.stringify(l)); };

  const openNewProg = () => { setEditingProg(null); setProgName(""); setProgDay(""); setProgExs([{ block: "A", name: "", sets: 3, reps: "8" }]); setShowProgModal(true); };
  const openEditProg = (p: Program) => { setEditingProg(p); setProgName(p.name); setProgDay(p.day); setProgExs([...p.exercises]); setShowProgModal(true); };

  const saveProg = () => {
    const exs = progExs.filter(e => e.name.trim()).sort((a, b) => a.block.localeCompare(b.block));
    if (!progName.trim() || !exs.length) return;
    const prog: Program = { id: editingProg?.id || Date.now().toString(), name: progName.trim(), day: progDay.trim(), exercises: exs };
    if (editingProg) savePrograms(programs.map(p => p.id === editingProg.id ? prog : p));
    else savePrograms([...programs, prog]);
    setShowProgModal(false);
  };

  const deleteProg = () => { if (editingProg) savePrograms(programs.filter(p => p.id !== editingProg.id)); setShowProgModal(false); };

  const startWO = (prog: Program) => {
    setActiveWO({
      name: prog.name, date: today(),
      exercises: prog.exercises.map(e => ({ block: e.block, name: e.name, sets: Array.from({ length: e.sets }, () => ({ done: false, weight: "", reps: e.reps })) }))
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

  const finishWO = () => {
    if (!activeWO) return;
    const log: Log = {
      id: Date.now().toString(), name: activeWO.name, date: activeWO.date,
      exercises: activeWO.exercises.map(e => ({ block: e.block, name: e.name, sets: e.sets.filter(s => s.weight || s.reps).map(s => ({ weight: s.weight || "0", reps: s.reps || "0" })) })).filter(e => e.sets.length > 0)
    };
    if (log.exercises.length > 0) saveLogs([...logs, log]);
    setActiveWO(null); setShowWOModal(false);
  };

  const updateSet = (ei: number, si: number, field: "weight" | "reps" | "done", val: string | boolean) => {
    if (!activeWO) return;
    const exs = activeWO.exercises.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, [field]: val }) });
    setActiveWO({ ...activeWO, exercises: exs });
  };

  const addSet = (ei: number) => {
    if (!activeWO) return;
    const exs = activeWO.exercises.map((e, i) => i !== ei ? e : { ...e, sets: [...e.sets, { done: false, weight: "", reps: "" }] });
    setActiveWO({ ...activeWO, exercises: exs });
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

  const s = { card: "bg-white rounded-xl border border-black/10 overflow-hidden", row: "flex items-center px-4 py-3 border-b border-black/8 last:border-0 cursor-pointer active:bg-gray-50", input: "w-full px-3 py-2 bg-gray-100 border border-black/10 rounded-lg text-sm text-gray-900 font-sans", label: "block text-xs font-medium text-gray-500 mb-1" };

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-gray-100 pb-20 relative">

      {/* HOME */}
      {screen === "home" && (
        <div>
          <div className="bg-white px-5 pt-14 pb-4 border-b border-black/10">
            <h1 className="text-3xl font-bold tracking-tight">LiftLog</h1>
            <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <div className="mx-4 mt-4 grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-xl border border-black/10 p-4"><p className="text-xs text-gray-500 mb-1">Sessions this week</p><p className="text-2xl font-semibold">{weekSessions}</p></div>
            <div className="bg-white rounded-xl border border-black/10 p-4"><p className="text-xs text-gray-500 mb-1">Volume today</p><p className="text-2xl font-semibold">{Math.round(todayVol)} <span className="text-sm font-normal text-gray-500">kg</span></p></div>
          </div>
          <div className="mx-4 mt-4"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">Start workout</p>
            <div className={s.card}>
              {programs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">No programs yet</div> :
                programs.map(p => (
                  <div key={p.id} className={s.row} onClick={() => startWO(p)}>
                    <div className="flex gap-1 mr-3">{[...new Set(p.exercises.map(e => e.block))].map(b => <BlockDot key={b} block={b} size={22} />)}</div>
                    <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-gray-500">{p.day || "Any day"} · {p.exercises.length} exercises</p></div>
                    <span className="text-xs font-medium text-blue-500 bg-blue-50 px-3 py-1 rounded-full">Start</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="mx-4 mt-4"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">Recent</p>
            <div className={s.card}>
              {logs.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">No sessions yet</div> :
                logs.slice(-4).reverse().map(l => (
                  <div key={l.id} className={s.row}>
                    <div className="flex-1"><p className="text-sm font-medium">{l.name}</p><p className="text-xs text-gray-500">{fmtDate(l.date)} · {Math.round(calcVol(l))} kg</p></div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PROGRAMS */}
      {screen === "programs" && (
        <div>
          <div className="bg-white px-5 pt-14 pb-4 border-b border-black/10"><h1 className="text-3xl font-bold tracking-tight">Programs</h1></div>
          <div className="mx-4 mt-4">
            <div className={s.card}>
              {programs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Tap + to create your first program</div> :
                programs.map(p => (
                  <div key={p.id} className={s.row} onClick={() => openEditProg(p)}>
                    <div className="flex gap-1 mr-3">{[...new Set(p.exercises.map(e => e.block))].map(b => <BlockDot key={b} block={b} size={22} />)}</div>
                    <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-gray-500">{p.day || "Any day"} · {p.exercises.length} exercises</p></div>
                    <span className="text-gray-300 text-base">›</span>
                  </div>
                ))}
            </div>
          </div>
          <button onClick={openNewProg} className="fixed bottom-20 right-4 w-13 h-13 bg-blue-500 rounded-full text-white text-2xl shadow-lg flex items-center justify-center" style={{ width: 52, height: 52 }}>+</button>
        </div>
      )}

      {/* HISTORY */}
      {screen === "history" && (
        <div>
          <div className="bg-white px-5 pt-14 pb-4 border-b border-black/10"><h1 className="text-3xl font-bold tracking-tight">History</h1></div>
          <div className="mx-4 mt-4 space-y-3">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">No sessions yet</div> :
              logs.slice().reverse().map(l => {
                const blocks: Record<string, LogExercise[]> = {};
                l.exercises.forEach(e => { if (!blocks[e.block]) blocks[e.block] = []; blocks[e.block].push(e); });
                return (
                  <div key={l.id} className={s.card}>
                    <div className="px-4 py-3 border-b border-black/8 flex justify-between items-center">
                      <span className="text-sm font-semibold">{l.name}</span>
                      <span className="text-xs text-gray-500">{fmtDate(l.date)} · {Math.round(calcVol(l))} kg</span>
                    </div>
                    {Object.entries(blocks).map(([b, exs]) => (
                      <div key={b} className="px-4 py-2.5 border-b border-black/6 last:border-0 flex gap-3">
                        <BlockDot block={b} size={26} />
                        <div>{exs.map(e => (<div key={e.name}><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-gray-500">{e.sets.filter(s => s.weight).map(s => `${s.weight}kg×${s.reps}`).join(" / ")}</p></div>))}</div>
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
          <div className="bg-white px-5 pt-14 pb-4 border-b border-black/10"><h1 className="text-3xl font-bold tracking-tight">Records</h1></div>
          <div className="mx-4 mt-4">
            <div className={s.card}>
              {Object.keys(prs).length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">Log weights to track PRs</div> :
                Object.entries(prs).sort((a, b) => b[1].w - a[1].w).map(([name, pr]) => (
                  <div key={name} className="flex items-center px-4 py-3 border-b border-black/8 last:border-0">
                    <div className="flex-1 text-sm font-medium">{name}</div>
                    <div className="text-right"><p className="text-base font-semibold">{pr.w} kg <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">PR</span></p><p className="text-xs text-gray-500">×{pr.reps} · {fmtDate(pr.date)}</p></div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur border-t border-black/10 flex pb-5 pt-2 z-50">
        {[["home", "🏠", "Home"], ["programs", "📋", "Programs"], ["history", "📊", "History"], ["pr", "🏆", "Records"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setScreen(id)} className="flex-1 flex flex-col items-center gap-0.5 border-none bg-transparent cursor-pointer">
            <span className="text-xl">{icon}</span>
            <span className={`text-[10px] ${screen === id ? "text-blue-500" : "text-gray-400"}`}>{label}</span>
          </button>
        ))}
      </nav>

      {/* MODAL: Program Editor */}
      {showProgModal && (
        <div className="fixed inset-0 bg-black/45 z-[200] flex items-end justify-center" onClick={() => setShowProgModal(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-[430px] max-h-[92vh] overflow-y-auto pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-gray-300 rounded mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 sticky top-0 bg-white z-10">
              <span className="text-base font-semibold">{editingProg ? "Edit program" : "New program"}</span>
              <button onClick={() => setShowProgModal(false)} className="bg-gray-100 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 text-sm border-none cursor-pointer">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div><label className={s.label}>Program name</label><input className={s.input} placeholder="e.g. Push Day" value={progName} onChange={e => setProgName(e.target.value)} /></div>
              <div><label className={s.label}>Day (optional)</label><input className={s.input} placeholder="e.g. Monday" value={progDay} onChange={e => setProgDay(e.target.value)} /></div>
              <div className="space-y-2">
                {progExs.map((ex, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 relative">
                    <button onClick={() => setProgExs(progExs.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-red-400 text-lg bg-transparent border-none cursor-pointer">×</button>
                    <div className="flex gap-2 flex-wrap">
                      <div className="min-w-0" style={{ flex: "0 0 60px" }}><label className={s.label}>Block</label>
                        <select className={s.input} value={ex.block} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, block: e.target.value } : x))}>
                          {BLOCKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[120px]"><label className={s.label}>Exercise</label><input className={s.input} placeholder="e.g. Bench Press" value={ex.name} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                      <div style={{ flex: "0 0 52px" }}><label className={s.label}>Sets</label><input className={s.input} type="number" min={1} max={10} value={ex.sets} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, sets: parseInt(e.target.value) || 3 } : x))} /></div>
                      <div style={{ flex: "0 0 52px" }}><label className={s.label}>Reps</label><input className={s.input} placeholder="8" value={ex.reps} onChange={e => setProgExs(progExs.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setProgExs([...progExs, { block: "A", name: "", sets: 3, reps: "8" }])} className="w-full py-3 bg-white text-blue-500 border border-black/10 rounded-xl text-sm font-medium cursor-pointer">+ Add exercise</button>
              <button onClick={saveProg} className="w-full py-3.5 bg-blue-500 text-white rounded-xl text-sm font-semibold cursor-pointer">Save program</button>
              {editingProg && <button onClick={deleteProg} className="w-full py-3.5 bg-white text-red-500 border border-black/10 rounded-xl text-sm font-medium cursor-pointer">Delete program</button>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Active Workout */}
      {showWOModal && activeWO && (
        <div className="fixed inset-0 z-[300] overflow-y-auto bg-gray-100">
          <div className="bg-blue-500 px-5 pt-14 pb-4">
            <div className="flex justify-between items-start">
              <div><h1 className="text-2xl font-bold text-white tracking-tight">{activeWO.name}</h1><p className="text-sm text-blue-100 mt-0.5">{activeWO.exercises.length} exercises</p></div>
              <button onClick={() => setShowWOModal(false)} className="bg-white/20 border-none rounded-full w-8 h-8 text-white cursor-pointer flex items-center justify-center">✕</button>
            </div>
          </div>
          <div className="pb-6">
            {Object.entries(groupByBlock(activeWO.exercises)).map(([b, items]) => (
              <div key={b} className="mx-4 mt-4">
                <div className="flex items-center gap-2.5 mb-2"><BlockDot block={b} /><span className="text-base font-semibold">Block {b}</span></div>
                {items.map(({ ex, ei }) => {
                  const last = getLastSets(ex.name);
                  return (
                    <div key={ei} className="bg-white rounded-xl border border-black/10 overflow-hidden mb-2">
                      <div className="px-4 py-3 bg-gray-50 border-b border-black/8 flex justify-between items-center">
                        <span className="text-sm font-semibold">{ex.name}</span>
                        <span className="text-xs text-gray-500">{last ? `Last: ${last.slice(0, 2).map(s => `${s.weight}×${s.reps}`).join(", ")}` : "No history"}</span>
                      </div>
                      <div className="px-3 pt-2 pb-1">
                        <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-1.5 mb-1">
                          <div /><div className="text-center text-xs text-gray-400">kg</div><div className="text-center text-xs text-gray-400">reps</div><div />
                        </div>
                        {ex.sets.map((set, si) => (
                          <div key={si} className="grid grid-cols-[32px_1fr_1fr_32px] gap-1.5 mb-1.5 items-center">
                            <div onClick={() => updateSet(ei, si, "done", !set.done)} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium cursor-pointer border ${set.done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-400"}`}>{set.done ? "✓" : si + 1}</div>
                            <input className="py-2 px-1 bg-gray-100 border border-black/10 rounded-lg text-sm text-center font-sans w-full" placeholder={last?.[si]?.weight || "--"} value={set.weight} onChange={e => updateSet(ei, si, "weight", e.target.value)} />
                            <input className="py-2 px-1 bg-gray-100 border border-black/10 rounded-lg text-sm text-center font-sans w-full" placeholder={last?.[si]?.reps || "--"} value={set.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)} />
                            <div />
                          </div>
                        ))}
                        <button onClick={() => addSet(ei)} className="text-blue-500 text-xs font-medium bg-transparent border-none cursor-pointer py-1">+ Set</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="mx-4 mt-4"><button onClick={finishWO} className="w-full py-3.5 bg-blue-500 text-white rounded-xl text-sm font-semibold cursor-pointer">Finish &amp; save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
