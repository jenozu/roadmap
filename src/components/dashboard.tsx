"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { firstProject, type Project, type ProjectSnapshot } from "@/lib/github";
import type { Island, Task } from "@/lib/roadmap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Location = { x: number; y: number };
type Drag = {
  id: string | null;
  pointerId: number;
  x: number;
  y: number;
  origin: Location;
  scroll: number;
  moved: boolean;
};
const fleetKey = "voyages:projects:v1";
const layoutPrefix = "voyages:layout:";
const track = [372, 208, 406, 260, 386, 185, 368, 250, 418, 212, 360, 202, 344];
function defaultLocation(index: number): Location {
  return { x: 160 + index * 260, y: track[index % track.length] };
}
function progressStatus(island: Island, firstOpen: number): string {
  if (island.tasks.length && island.progress === 100) return "complete";
  if (island.number === firstOpen) return "current";
  return "charted";
}
function timeAgo(input: string): string {
  const diff = Math.floor((Date.now() - Date.parse(input)) / 60000);
  if (!Number.isFinite(diff) || diff < 0) return "";
  if (diff < 60) return diff + "m ago";
  if (diff < 1440) return Math.floor(diff / 60) + "h ago";
  return Math.floor(diff / 1440) + "d ago";
}
function inkPath(points: Location[]): string {
  return points.map((point, index) => {
    if (index === 0) return "M " + point.x + " " + point.y;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return " C " + middle + " " + previous.y + ", " + middle + " " + point.y + ", " + point.x + " " + point.y;
  }).join("");
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([firstProject]);
  const [activeId, setActiveId] = useState(firstProject.id);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [questsOpen, setQuestsOpen] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const questScroll = useRef<HTMLDivElement>(null);
  const savedQuestScrollTop = useRef(0);
  const [positions, setPositions] = useState<Record<string, Location>>({});
  const [zoom, setZoom] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("master_list.md");
  const [newBranch, setNewBranch] = useState("main");
  const [addError, setAddError] = useState("");
  const mapViewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const positionsRef = useRef<Record<string, Location>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(fleetKey);
      if (saved) {
        const stored = JSON.parse(saved) as Project[];
        if (Array.isArray(stored)) {
          const known = new Map<string, Project>([[firstProject.id, firstProject]]);
          for (const item of stored) {
            if (item && /^[\w.\-]+\/[\w.\-]+$/.test(item.repo)) known.set(item.id, item);
          }
          setProjects([...known.values()]);
        }
      }
    } catch { /* local storage can be unavailable */ }
  }, []);

  useEffect(() => {
    setExpandedTask(null);
    savedQuestScrollTop.current = 0;
    if (questScroll.current) questScroll.current.scrollTop = 0;
  }, [selected, activeId]);

  useEffect(() => {
    if (questsOpen && questScroll.current) {
      questScroll.current.scrollTop = savedQuestScrollTop.current;
    }
  }, [questsOpen]);

  useEffect(() => {
    if (!questsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuestsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [questsOpen]);

  const active = projects.find(p => p.id === activeId) || firstProject;
  const load = useCallback(async (signal: AbortSignal) => {
    const query = new URLSearchParams({
      repo: active.repo, branch: active.branch, path: active.path, name: active.name
    });
    const response = await fetch("/api/project?" + query.toString(), { cache: "no-store", signal });
    const body = await response.json() as ProjectSnapshot & { error?: string };
    if (!response.ok) throw new Error(body.error || "Unable to load the project.");
    return body;
  }, [active.repo, active.branch, active.path, active.name]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void load(controller.signal)
      .then(body => {
        if (controller.signal.aborted) return;
        setSnapshot(body);
        setSelected(previous => body.voyage.islands.some(i => i.id === previous)
          ? previous : (body.voyage.islands.find(i => i.progress < 100)?.id || body.voyage.islands[0]?.id || null));
        try {
          const saved = localStorage.getItem(layoutPrefix + active.repo);
          const savedPositions = saved ? JSON.parse(saved) as Record<string, Location> : {};
          positionsRef.current = savedPositions;
          setPositions(savedPositions);
        } catch { positionsRef.current = {}; setPositions({}); }
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Import failed."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, tick, active.repo]);

  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 90000);
    return () => clearInterval(timer);
  }, []);

  const islands = snapshot?.voyage.islands || [];
  const current = islands.find(i => i.progress < 100)?.number ?? islands[0]?.number ?? -1;
  const mapWidth = Math.max(1650, islands.length * 260 + 280);
  const locations = useMemo(() => islands.map((island, index) => positions[island.id] || defaultLocation(index)), [islands, positions]);
  const journeyPath = inkPath(locations);
  const selectedIsland = islands.find(i => i.id === selected) || null;
  const xp = snapshot?.voyage.xp || 0;
  const currentLevelXp = xp % 500;
  const projectFileUrl = "https://github.com/" + active.repo + "/blob/" + encodeURIComponent(active.branch) + "/" + active.path;

  function persistProjects(next: Project[]) {
    setProjects(next);
    try { localStorage.setItem(fleetKey, JSON.stringify(next)); } catch { /* non-fatal */ }
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError("");
    const repo = newRepo.trim();
    const path = newPath.trim();
    const branch = newBranch.trim();
    if (!/^[\w.\-]+\/[\w.\-]+$/.test(repo) || !/^[\w./\-]+\.md$/.test(path) ||
        path.includes("..") || !/^[\w./\-]+$/.test(branch) || branch.includes("..")) {
      setAddError("Use owner/repo, a Markdown path and a valid branch.");
      return;
    }
    const project: Project = {
      id: repo.toLowerCase().replace(/[^a-z\d-]+/g, "-"),
      repo,
      path,
      branch,
      name: newName.trim() || repo.split("/")[1]
    };
    const next = [...projects.filter(p => p.id !== project.id), project];
    persistProjects(next);
    setActiveId(project.id);
    setSnapshot(null);
    setSelected(null);
    setQuestsOpen(true);
    setShowAdd(false);
  }

  function selectIsland(id: string) {
    savedQuestScrollTop.current = 0;
    if (questScroll.current) questScroll.current.scrollTop = 0;
    setSelected(id);
    setQuestsOpen(true);
    setExpandedTask(null);
  }

  function toggleQuests() {
    if (!selected && islands.length > 0) {
      setSelected(islands.find(island => island.progress < 100)?.id || islands[0].id);
    }
    setQuestsOpen(open => !open);
  }

  function onDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!mapViewport.current) return;
    const element = (event.target as Element).closest("[data-island]");
    const id = element?.getAttribute("data-island") || null;
    const index = islands.findIndex(i => i.id === id);
    drag.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: index >= 0 ? locations[index] : { x: 0, y: 0 },
      scroll: mapViewport.current.scrollLeft,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !mapViewport.current) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.id) {
      const visualWidth = event.currentTarget.getBoundingClientRect().width;
      const multiplier = mapWidth / visualWidth;
      const updated = {
        ...positionsRef.current,
        [gesture.id]: {
          x: Math.max(95, Math.min(mapWidth - 95, gesture.origin.x + dx * multiplier)),
          y: Math.max(115, Math.min(600, gesture.origin.y + dy * multiplier))
        }
      };
      positionsRef.current = updated;
      setPositions(updated);
    } else {
      mapViewport.current.scrollLeft = gesture.scroll - dx;
    }
  }

  function onUp(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.id && !gesture.moved) selectIsland(gesture.id);
    if (gesture.id && gesture.moved) {
      try { localStorage.setItem(layoutPrefix + active.repo, JSON.stringify(positionsRef.current)); } catch { /* non-fatal */ }
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resetLayout() {
    positionsRef.current = {};
    setPositions({});
    try { localStorage.removeItem(layoutPrefix + active.repo); } catch { /* non-fatal */ }
  }

  async function copyBrief(task: Task) {
    if (!selectedIsland) return;
    const lines = [
      "Repository: " + active.repo,
      "Roadmap: " + active.path,
      "Milestone: Phase " + selectedIsland.number + " — " + selectedIsland.name,
      "Goal: " + selectedIsland.goal,
      "Section: " + task.section,
      "Task: " + task.title,
      "Source: " + projectFileUrl + "#L" + task.line,
      "First inspect the current repository. Do not duplicate existing work. Follow project rules and verify changes."
    ];
    if (task.instructions.length) {
      lines.push("Task-specific steps from the roadmap:\n" + task.instructions.join("\n"));
    }
    const sectionGuide = selectedIsland.sections.find(guide => guide.id === task.sectionId);
    if (sectionGuide?.notes) lines.push("Related section guidance:\n" + sectionGuide.notes);
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* clipboard may be blocked */ }
  }

  return (
    <div className="shell">
      <aside className="fleet">
        <div className="brand"><span className="brand-emblem">✧</span><div><strong>VOYAGES</strong><small>PROJECT CARTOGRAPHY</small></div></div>
        <div className="fleet-heading">THE FLEET <span>{projects.length} voyage{projects.length === 1 ? "" : "s"}</span></div>
        <div className="project-list">
          {projects.map(project => (
            <button key={project.id} type="button"
              className={"project-choice " + (active.id === project.id ? "active" : "")}
              onClick={() => { setActiveId(project.id); setSnapshot(null); setSelected(null); }}>
              <span className="project-crest">⚓</span>
              <span><strong>{project.name}</strong><small>{project.repo}</small></span>
              {active.id === project.id && <span className="choice-chevron">›</span>}
            </button>
          ))}
        </div>
        <button className="new-voyage" onClick={() => setShowAdd(value => !value)}>＋ Chart a new voyage</button>
        {showAdd && (
          <form className="add-form" onSubmit={addProject}>
            <label>Repository <input required placeholder="owner/repo" value={newRepo} onChange={e => setNewRepo(e.target.value)} /></label>
            <label>Display name <input placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} /></label>
            <label>Markdown roadmap <input required value={newPath} onChange={e => setNewPath(e.target.value)} /></label>
            <label>Branch <input required value={newBranch} onChange={e => setNewBranch(e.target.value)} /></label>
            {addError && <p className="form-error">{addError}</p>}
            <button className="action-button" type="submit">Add public repository</button>
          </form>
        )}
        <div className="fleet-foot">
          <span className="compass-mini">✥</span>
          <p>Your GitHub roadmaps are the source of truth. Your map remembers where you left off.</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><div className="eyebrow">THE CAPTAIN&apos;S TABLE / {active.repo.toUpperCase()}</div><h1>{active.name} <span className="title-flourish">✣</span></h1><p>Every finished quest brings the destination a little closer.</p></div>
          <div className="top-actions">
            <a className="secondary-button" href={projectFileUrl} target="_blank" rel="noreferrer">View roadmap ↗</a>
            <button className="action-button" disabled={loading} onClick={() => setTick(n => n + 1)}>{loading ? "Charting..." : "↻ Sync voyage"}</button>
          </div>
        </header>

        <section className="stats-row" aria-label="Project summary">
          <div className="stat"><small>THE VOYAGE</small><strong>{snapshot?.voyage.progress ?? "—"}<span>%</span></strong><p>Overall completion</p></div>
          <div className="stat"><small>DISCOVERED ISLANDS</small><strong>{islands.filter(i => i.tasks.length > 0 && i.progress === 100).length}<span> / {islands.length || "—"}</span></strong><p>Completed milestones</p></div>
          <div className="stat"><small>QUESTS COMPLETED</small><strong>{snapshot?.voyage.completedCount ?? "—"}<span> / {snapshot?.voyage.taskCount ?? "—"}</span></strong><p>From your repository</p></div>
          <div className="stat stat-level"><small>CAPTAIN&apos;S LEVEL</small><strong>{snapshot?.voyage.level ?? "—"}</strong><div className="level-track"><span style={{ width: currentLevelXp / 5 + "%" }} /></div><p>{currentLevelXp} / 500 XP to next level</p></div>
        </section>

        <section className="atlas-panel" aria-label="Interactive voyage map">
          <div className="atlas-top">
            <div><span className="eyebrow">YOUR CHARTED COURSE</span><h2>The expedition map</h2></div>
            <div className="map-actions">
              <span className="sync-stamp">{snapshot ? "Last checked " + new Date(snapshot.updatedAt).toLocaleTimeString() : "Awaiting chart"}</span>
              <button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.7, +(z - 0.1).toFixed(2)))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(1.6, +(z + 0.1).toFixed(2)))}>＋</button>
              <button onClick={resetLayout}>Reset islands</button>
              <button className="map-quest-toggle" aria-expanded={questsOpen} onClick={toggleQuests}>
                {questsOpen ? "Hide quests" : "Show quests"}
              </button>
            </div>
          </div>
          {error && <div className="error-banner">Could not fetch roadmap: {error} <button onClick={() => setTick(t => t + 1)}>Retry</button></div>}
          {!error && loading && !snapshot && <div className="loading-banner">Unrolling the charts and finding your islands…</div>}
          <div className="map-scroll" ref={mapViewport}>
            <svg className="treasure-map" viewBox={"0 0 " + mapWidth + " 700"}
              style={{ width: mapWidth * zoom, height: 700 * zoom }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerCancel={onUp} aria-label="Draggable treasure map of project milestones">
              <defs>
                <pattern id="waves" width="150" height="130" patternUnits="userSpaceOnUse">
                  <path d="M12 35q11 -6 23 0m24 55q11 -6 23 0m61 -60q9 -5 20 0" fill="none" stroke="#5b756c" strokeWidth="1" opacity=".23" />
                </pattern>
                <pattern id="graticule" width="120" height="120" patternUnits="userSpaceOnUse">
                  <path d="M120 0H0V120" fill="none" stroke="#796f50" opacity=".11" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={mapWidth} height="700" fill="#d9d1ad" />
              <rect width={mapWidth} height="700" fill="url(#graticule)" />
              <rect width={mapWidth} height="700" fill="url(#waves)" />
              <path d={"M 35 35 H " + (mapWidth - 35) + " V 665 H 35 Z"} fill="none" stroke="#847454" strokeWidth="1.3" opacity=".55" />
              <g transform="translate(125 96)" opacity=".66">
                <circle r="50" stroke="#53422f" strokeWidth="1" fill="none" />
                <circle r="37" stroke="#53422f" strokeWidth=".5" fill="none" />
                <path d="M0-62L9-10L63 0L9 10L0 62L-9 10L-63 0L-9-10Z" fill="#604934" />
                <path d="M0-50L5 0L0 50L-5 0Z" fill="#e8dfbd" />
                <text y="-67" textAnchor="middle" fontSize="20">N</text><text x="72" y="6" fontSize="16">E</text>
                <text y="82" textAnchor="middle" fontSize="16">S</text><text x="-84" y="6" fontSize="16">W</text>
              </g>
              <text x={mapWidth * .43} y="85" textAnchor="middle" className="map-sea-title">THE UNCHARTED WATERS</text>
              <text x={mapWidth * .69} y="590" textAnchor="middle" className="map-sea-subtitle">FORTUNE FAVOURS THE STEADFAST</text>
              {locations.length > 1 && <><path d={journeyPath} stroke="#75452f" strokeWidth="3.5" strokeDasharray="2 17" strokeLinecap="round" fill="none" opacity=".85" />
                {locations.slice(0, -1).map((p, index) => {
                  const q = locations[index + 1];
                  return <circle key={index} cx={(p.x + q.x) / 2} cy={(p.y + q.y) / 2} r="3.5" fill="#79583a" />;
                })}
              </>}
              {islands.map((island, index) => {
                const pos = locations[index];
                const status = progressStatus(island, current);
                const chosen = selected === island.id;
                return (
                  <g key={island.id} data-island={island.id} transform={"translate(" + pos.x + " " + pos.y + ")"}
                    tabIndex={0} role="button" aria-label={"Island " + island.number + ": " + island.name + ", " + island.progress + "% completed"}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectIsland(island.id); } }}
                    className={"map-island " + status + (chosen ? " chosen" : "")}>
                    {chosen && <ellipse rx="91" ry="74" cy="-1" fill="none" stroke="#7c5734" strokeWidth="1.4" strokeDasharray="4 7" />}
                    <path d="M-76 4 Q-62 -15 -44 -12 Q-30 -38 -10 -30 Q2 -49 23 -32 Q49 -34 58 -12 Q84 -10 77 14 Q70 31 50 33 Q30 49 11 36 Q-7 51 -33 34 Q-63 38 -76 4Z"
                      fill={status === "complete" ? "#a9b292" : status === "current" ? "#d3b77e" : "#c7b891"} stroke="#4e4934" strokeWidth="2" />
                    <path d="M-70 8 Q-45 -8 -26 14 T19 10 T70 15 M-48 24 Q-17 30 10 17" fill="none" stroke="#7a7353" opacity=".55" strokeWidth="1" />
                    <path d="M-31 -6L-19 -35L-8 -8L7 -42L26 -7 M-26 -7L-19 -17L-15 -10 M6 -8L8 -20L14 -11" fill="none" stroke="#544d39" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M40 4v-18m0 3l-13 -7m13 7l14-9m-14 9l-6 -12" stroke="#504b35" fill="none" strokeWidth="2" />
                    <circle cx="40" cy="-26" r="4" fill="#777b5c" />
                    {status === "complete" && <g transform="translate(0 -53)"><circle r="19" fill="#496c50" stroke="#eee8c9" strokeWidth="3" /><path d="m-9 0 7 7 13-15" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>}
                    {status === "current" && <g transform="translate(0 -57)"><path d="M0 -25C-34 -25 -33 13 0 35C33 13 34 -25 0 -25Z" fill="#3e7788" stroke="#f4e8c7" strokeWidth="3" /><circle cy="-5" r="7" fill="#f4e8c7" /></g>}
                    {status === "charted" && <g transform="translate(0 -54)"><circle r="15" fill="#6f6b55" stroke="#e9d8ac" strokeWidth="2" /><text textAnchor="middle" dy="6" fontSize="20" fill="#fff0cb">?</text></g>}
                    <rect x="-111" y="43" width="222" height="62" rx="4" fill="#efe1b9" stroke="#856d48" strokeWidth={chosen ? 2.5 : 1.3} />
                    <text className="island-number" x="0" y="61" textAnchor="middle">ISLAND {String(island.number + 1).padStart(2, "0")}</text>
                    <text className="island-name" x="0" y="81" textAnchor="middle">{island.name.length > 23 ? island.name.slice(0, 21) + "…" : island.name}</text>
                    <text className="island-progress" x="0" y="97" textAnchor="middle">{island.progress}% COMPLETE</text>
                  </g>
                );
              })}
              {current >= 0 && (() => {
                const index = islands.findIndex(i => i.number === current);
                if (index < 0) return null;
                const point = locations[index];
                return <g transform={"translate(" + (point.x - 125) + " " + (point.y + 105) + ")"} opacity=".8">
                  <path d="M-28 8h66l-14 9h-41z M4 6v-51l-31 49H4l32-30-31-10" fill="#58422d" stroke="#58422d" strokeWidth="1" />
                  <path d="M4-46v-10 M4-55l24 5-24 5" stroke="#58422d" fill="none" strokeWidth="2" />
                </g>;
              })()}
            </svg>
          </div>
          <div className="map-bottom"><span><i className="legend-dot done-dot" />Completed</span><span><i className="legend-dot current-dot" />Your current island</span><span><i className="legend-dot future-dot" />Upcoming</span><span className="drag-hint">Drag the sea to navigate · Drag an island to arrange · Click an island to explore</span></div>
        </section>

        <section className="below-grid">
          <article className="paper-card">
            <div className="card-heading"><div><small className="eyebrow">THE SHIP&apos;S LOG</small><h2>Recent chart updates</h2></div><a href={"https://github.com/" + active.repo + "/commits/" + encodeURIComponent(active.branch) + "/" + active.path} target="_blank" rel="noreferrer">GitHub ↗</a></div>
            {snapshot?.activity.length ? snapshot.activity.map(item => <div className="activity" key={item.id}>
              <div className="activity-bullet">✦</div><div><a href={item.url} target="_blank" rel="noreferrer">{item.message}</a><small>{item.author} · {timeAgo(item.date)}</small></div>
            </div>) : <p className="empty-note">Roadmap commit history will appear here when GitHub is available.</p>}
            <p className="subtle-note">This feed shows actual roadmap commits, not unverified task-completion claims.</p>
          </article>
          <article className="paper-card">
            <div className="card-heading"><div><small className="eyebrow">YOUR NEXT LANDFALL</small><h2>Upcoming quests</h2></div></div>
            {islands.filter(i => i.progress < 100).slice(0, 3).map(island => (
              <button className="next-island" key={island.id} onClick={() => selectIsland(island.id)}>
                <span className="quest-stamp">✧</span><span><strong>{island.name}</strong><small>{island.tasks.length - island.completed} quests remaining · {island.progress}% charted</small></span><b>↗</b>
              </button>
            ))}
            {islands.length > 0 && islands.every(i => i.progress === 100) && <p className="empty-note">Every island has been charted. Your expedition is complete.</p>}
          </article>
        </section>
      </main>

      {islands.length > 0 && <button
        type="button"
        className={"quest-edge-tab " + (questsOpen && selectedIsland ? "tab-open" : "tab-closed")}
        aria-controls="quest-panel"
        aria-expanded={Boolean(questsOpen && selectedIsland)}
        aria-label={questsOpen && selectedIsland ? "Hide quest panel" : "Open quest panel"}
        onClick={toggleQuests}>
        <span aria-hidden="true" className="quest-tab-symbol">{questsOpen && selectedIsland ? "›" : "‹"}</span>
        <span>{questsOpen && selectedIsland ? "HIDE QUESTS" : "OPEN QUESTS"}</span>
      </button>}
      {questsOpen && selectedIsland && <aside id="quest-panel" className="quest-drawer" aria-label="Selected island quests">
        <div className="drawer-fixed">
          <button className="drawer-close" type="button" aria-label="Hide quest panel" onClick={() => setQuestsOpen(false)}>×</button>
          <div className="drawer-eyebrow">ISLAND {String(selectedIsland.number + 1).padStart(2, "0")} · EXPEDITION NOTES</div>
          <h2>{selectedIsland.name}</h2>
          <div className="drawer-summary">
            <span><strong>{selectedIsland.progress}%</strong> explored</span>
            <span><strong>{selectedIsland.completed}</strong> / {selectedIsland.tasks.length} quests</span>
          </div>
          <div className="drawer-progress"><span style={{ width: selectedIsland.progress + "%" }} /></div>
        </div>
        <div className="drawer-scroll" ref={questScroll}
          onScroll={event => { savedQuestScrollTop.current = event.currentTarget.scrollTop; }}>
          <p className="goal">{selectedIsland.goal || "Complete the quests recorded in the canonical project roadmap."}</p>
          <div className="drawer-heading"><h3>Quest checklist</h3><a target="_blank" rel="noreferrer" href={projectFileUrl}>Edit source ↗</a></div>
          <p className="quest-tip">Select any quest to see its existing instructions, related section work and completion criteria.</p>
          <div className="task-list">
            {selectedIsland.tasks.map(task => {
              const expanded = expandedTask === task.id;
              const guide = selectedIsland.sections.find(section => section.id === task.sectionId);
              const relatedTasks = selectedIsland.tasks.filter(item => item.sectionId === task.sectionId);
              const doneGuide = selectedIsland.sections.find(section => /^Done when$/i.test(section.title));
              const criteria = doneGuide && doneGuide.id !== task.sectionId
                ? selectedIsland.tasks.filter(item => item.sectionId === doneGuide.id)
                : [];
              const codeFiles = [...new Set(
                (task.title + "\n" + task.instructions.join("\n") + "\n" + (guide?.notes || ""))
                  .match(/\b(?:docs|scripts|src|deploy)\/[a-zA-Z0-9_./-]+\.(?:md|py|sh|service|timer|yml|yaml)\b/g) || []
              )].slice(0, 12);
              const asSourceLink = (path: string) => "https://github.com/" + active.repo + "/blob/" + encodeURIComponent(active.branch) + "/" + path;
              return <div className={"task " + (task.done ? "task-done " : "") + (expanded ? "task-expanded" : "")} key={task.id}>
                <div className="task-head">
                  <span className="task-check" aria-label={task.done ? "Complete" : "Incomplete"}>{task.done ? "✓" : ""}</span>
                  <button
                    type="button"
                    className="task-main"
                    aria-expanded={expanded}
                    aria-controls={"task-detail-" + task.id}
                    onClick={() => setExpandedTask(expanded ? null : task.id)}>
                    <small>{task.section}</small>
                    <span className="task-label">{task.title}</span>
                    <span className="task-expand-icon" aria-hidden="true">{expanded ? "−" : "+"}</span>
                  </button>
                </div>
                {expanded && <div id={"task-detail-" + task.id} className="task-detail">
                  <div className="detail-status">{task.done ? "✓ VERIFIED IN ROADMAP" : "○ NOT YET CHECKED OFF"}</div>
                  {task.instructions.length > 0 ? <>
                    <h4>Instructions for this quest</h4>
                    <div className="markdown-guide">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.instructions.join("\n")}</ReactMarkdown>
                    </div>
                  </> : <p className="detail-disclosure">The roadmap does not contain separate step-by-step instructions specifically for this quest. The following section work plan and source notes are provided as context.</p>}
                  {guide?.notes && <div className="detail-block">
                    <h4>{guide.title === "Overview" ? "Roadmap context" : guide.title + " — source notes"}</h4>
                    <div className="markdown-guide">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide.notes}</ReactMarkdown>
                    </div>
                  </div>}
                  {relatedTasks.length > 1 && <div className="detail-block">
                    <h4>Work plan from this section</h4>
                    <ol className="section-checklist">
                      {relatedTasks.slice(0, 28).map(item => (
                        <li key={item.id} className={item.done ? "checked-source" : ""}>
                          <span className="source-check">{item.done ? "✓" : "○"}</span>
                          <span>{item.title}</span>
                        </li>
                      ))}
                    </ol>
                    {relatedTasks.length > 28 && <p className="detail-disclosure">Showing the first 28 items. Open the full section in GitHub to see the rest.</p>}
                  </div>}
                  {criteria.length > 0 && <div className="detail-block">
                    <h4>Phase completion criteria</h4>
                    <ul className="section-checklist">
                      {criteria.map(item => <li key={item.id} className={item.done ? "checked-source" : ""}>
                        <span className="source-check">{item.done ? "✓" : "○"}</span><span>{item.title}</span>
                      </li>)}
                    </ul>
                  </div>}
                  {codeFiles.length > 0 && <div className="detail-block">
                    <h4>Referenced project files</h4>
                    <div className="referenced-files">{codeFiles.map(file =>
                      <a key={file} href={asSourceLink(file)} target="_blank" rel="noreferrer">{file} ↗</a>
                    )}</div>
                  </div>}
                  <div className="task-links expanded-links">
                    <a target="_blank" rel="noreferrer" href={projectFileUrl + "#L" + task.line}>Open exact source ↗</a>
                    <button type="button" onClick={() => void copyBrief(task)}>Copy task brief</button>
                  </div>
                </div>}
              </div>;
            })}
            {!selectedIsland.tasks.length && <p className="empty-note">This phase has no checkboxes yet. Add quests to the Markdown file to track it.</p>}
          </div>
          <div className="drawer-footer">Instructions are shown from your project's Markdown. To add deeper per-task procedures, include indented steps beneath a checklist item or link a detailed document in the same section. Progress remains read-only until secure GitHub editing is added.</div>
        </div>
      </aside>}
    </div>
  );
}
