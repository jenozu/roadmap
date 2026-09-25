"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { firstProject, type Project, type ProjectSnapshot } from "@/lib/github";
import type { Island, Task } from "@/lib/roadmap";
import { layoutForCount, clampIsland, type Point } from "@/lib/map-layout";
import { centerAt, visibleCenter, fitCamera, openingScale, zoomAround, panCamera } from "@/lib/map-camera";
import IslandSketch from "@/components/island-sketch";
import { resolveRoadmapHref } from "@/lib/roadmap-links";
import { captureProgress, diffProgress, type ProgressChange, type ProgressState } from "@/lib/progress-diff";
import { fleetStorageKey, readFleet, saveVoyage, removeVoyage } from "@/lib/voyage-manager";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Location = Point;
type Drag = {
  id: string | null;
  pointerId: number;
  x: number;
  y: number;
  origin: Location;
  camera: Location;
  moved: boolean;
};

const layoutPrefix = "voyages:archipelago-layout:v2:";
const progressPrefix = "voyages:recorded-progress:v1:";
const historyPrefix = "voyages:observed-task-events:v1:";
function progressStatus(island: Island, firstOpen: number): "complete" | "current" | "charted" {
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
  const [fleetReady, setFleetReady] = useState(false);
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentChanges, setRecentChanges] = useState<ProgressChange[]>([]);
  const [copiedNotice, setCopiedNotice] = useState<{ id: string; ok: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const questScroll = useRef<HTMLDivElement>(null);
  const savedQuestScrollTop = useRef(0);
  const [positions, setPositions] = useState<Record<string, Location>>({});
  const [zoom, setZoom] = useState(.72);
  const zoomRef = useRef(.72);
  const [camera, setCamera] = useState<Location>({ x: 0, y: 0 });
  const cameraRef = useRef<Location>({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const initializedMap = useRef("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [newRepo, setNewRepo] = useState("");
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("master_plan.md");
  const [newBranch, setNewBranch] = useState("main");
  const [addError, setAddError] = useState("");
  const mapViewport = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const positionsRef = useRef<Record<string, Location>>({});

  useEffect(() => {
    try {
      const restored = readFleet(localStorage.getItem(fleetStorageKey), firstProject);
      setProjects(restored);
      setActiveId(restored[0]?.id || "");
    } catch {
      setProjects([firstProject]);
      setActiveId(firstProject.id);
    } finally {
      setFleetReady(true);
    }
  }, []);

  useEffect(() => {
    setExpandedTask(null);
    setCopiedNotice(null);
    savedQuestScrollTop.current = 0;
    if (questScroll.current) questScroll.current.scrollTop = 0;
  }, [selected, activeId]);

  useEffect(() => {
    if (questsOpen && questScroll.current) {
      questScroll.current.scrollTop = savedQuestScrollTop.current;
    }
  }, [questsOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (questsOpen) setQuestsOpen(false);
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [questsOpen, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fullscreen]);

  const active = projects.find(p => p.id === activeId) || projects[0] || firstProject;
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
    if (!fleetReady || projects.length === 0) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void load(controller.signal)
      .then(body => {
        if (controller.signal.aborted) return;
        setSnapshot(body);
        // Local history records when changes were detected, never the date
        // the associated work actually happened. GitHub is the source.
        try {
          const key = body.project.repo + "@" + body.project.branch + "/" + body.project.path;
          const now = captureProgress(body.voyage, body.updatedAt);
          const priorText = localStorage.getItem(progressPrefix + key);
          const previous = priorText ? JSON.parse(priorText) as ProgressState : undefined;
          const incoming = previous && Array.isArray(previous.rows)
            ? diffProgress(previous, now) : [];
          const historyText = localStorage.getItem(historyPrefix + key);
          const existing = historyText ? JSON.parse(historyText) as ProgressChange[] : [];
          const history = [...incoming.reverse(), ...(Array.isArray(existing) ? existing : [])].slice(0, 30);
          localStorage.setItem(progressPrefix + key, JSON.stringify(now));
          localStorage.setItem(historyPrefix + key, JSON.stringify(history));
          setRecentChanges(history);
        } catch {
          setRecentChanges([]);
        }
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
  }, [load, tick, active.repo, fleetReady, projects.length]);

  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 90000);
    return () => clearInterval(timer);
  }, []);

  const islands = snapshot?.voyage.islands || [];
  const current = islands.find(i => i.tasks.length > 0 && i.progress < 100)?.number ?? islands[islands.length - 1]?.number ?? -1;
  const archipelago = useMemo(() => layoutForCount(islands.length), [islands.length]);
  const { width: mapWidth, height: mapHeight } = archipelago;
  const locations = useMemo(
    () => islands.map((island, index) => positions[island.id] || archipelago.points[index]),
    [islands, positions, archipelago]
  );
  const journeyPath = inkPath(locations);
  const selectedIsland = islands.find(i => i.id === selected) || null;
  const xp = snapshot?.voyage.xp || 0;
  const currentLevelXp = xp % 500;
  const projectFileUrl = "https://github.com/" + active.repo + "/blob/" + encodeURIComponent(active.branch) + "/" + active.path;

  function setCameraPosition(next: Location) {
    cameraRef.current = next;
    setCamera(next);
  }

  function setCameraZoom(next: number) {
    zoomRef.current = next;
    setZoom(next);
  }

  function fitMap() {
    const viewport = mapViewport.current;
    if (!viewport) return;
    const fit = fitCamera(
      { width: viewport.clientWidth, height: viewport.clientHeight },
      { width: mapWidth, height: mapHeight }
    );
    setCameraZoom(fit.scale);
    setCameraPosition(fit.camera);
    setQuestsOpen(false);
  }

  function changeZoom(amount: number) {
    const viewport = mapViewport.current;
    if (!viewport) return;
    const next = Math.max(.24, Math.min(1.85, +(zoomRef.current + amount).toFixed(2)));
    setCameraPosition(zoomAround(cameraRef.current, zoomRef.current, next, {
      x: viewport.clientWidth / 2, y: viewport.clientHeight / 2
    }));
    setCameraZoom(next);
  }

  function focusOnIsland(id: string, openQuests = false) {
    const viewport = mapViewport.current;
    const index = islands.findIndex(island => island.id === id);
    if (!viewport || index < 0) return;
    const nextZoom = Math.max(.84, zoomRef.current);
    // Quest drawer overlays the right side; leave its map target visible.
    const questOverlap = openQuests ? Math.min(430, viewport.clientWidth * .38) : 0;
    setCameraPosition(centerAt(locations[index], {
      width: viewport.clientWidth - questOverlap, height: viewport.clientHeight
    }, nextZoom));
    setCameraZoom(nextZoom);
    if (openQuests) selectIsland(id);
    else setQuestsOpen(false);
  }

  function toggleFullscreen() {
    const viewport = mapViewport.current;
    const world = viewport
      ? visibleCenter(cameraRef.current, { width: viewport.clientWidth, height: viewport.clientHeight }, zoomRef.current)
      : { x: mapWidth / 2, y: mapHeight / 2 };
    setFullscreen(value => !value);
    setQuestsOpen(false);
    // Wait for the fixed-position viewport (or inline viewport) to reflow.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const resized = mapViewport.current;
      if (!resized) return;
      setCameraPosition(centerAt(world, {
        width: resized.clientWidth, height: resized.clientHeight
      }, zoomRef.current));
    }));
  }

  // The normal view begins at a readable zoom focused on the current
  // milestone. Whole Map is a separate explicit overview, not a tiny default.
  useEffect(() => {
    if (!snapshot || snapshot.project.repo !== active.repo || initializedMap.current === active.repo) return;
    initializedMap.current = active.repo;
    const frame = requestAnimationFrame(() => {
      const viewport = mapViewport.current;
      if (!viewport) return;
      const scale = openingScale(
        { width: viewport.clientWidth, height: viewport.clientHeight },
        { width: mapWidth, height: mapHeight }
      );
      const index = snapshot.voyage.islands.findIndex(island => island.tasks.length > 0 && island.progress < 100);
      const point = archipelago.points[Math.max(0, index)] || { x: mapWidth / 2, y: mapHeight / 2 };
      setCameraZoom(scale);
      setCameraPosition(centerAt(point, {
        width: viewport.clientWidth, height: viewport.clientHeight
      }, scale));
    });
    return () => cancelAnimationFrame(frame);
    // Initialize a repository once. Background syncs must not hijack the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.project.repo, active.repo, mapWidth, mapHeight]);

  // Trackpad wheel pans across the map; Ctrl+wheel / pinch zooms around the
  // cursor. Native non-passive listener prevents the page scrolling instead.
  useEffect(() => {
    const viewport = mapViewport.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey) {
        const rect = viewport.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const next = Math.max(.24, Math.min(1.85, zoomRef.current * (event.deltaY > 0 ? .92 : 1.08)));
        setCameraPosition(zoomAround(cameraRef.current, zoomRef.current, next, point));
        setCameraZoom(next);
      } else {
        setCameraPosition(panCamera(cameraRef.current, -event.deltaX, -event.deltaY));
      }
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, []);

  // Recenter the same world location after a browser resize, including the
  // CSS-only changes used by the full-window map mode.
  useEffect(() => {
    const viewport = mapViewport.current;
    if (!viewport) return;
    let previous = { width: viewport.clientWidth, height: viewport.clientHeight };
    const observer = new ResizeObserver(() => {
      const next = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (next.width <= 0 || next.height <= 0) return;
      if (previous.width === next.width && previous.height === next.height) return;
      const world = visibleCenter(cameraRef.current, previous, zoomRef.current);
      setCameraPosition(centerAt(world, next, zoomRef.current));
      previous = next;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function persistProjects(next: Project[]) {
    setProjects(next);
    try { localStorage.setItem(fleetStorageKey, JSON.stringify(next)); } catch { /* non-fatal */ }
  }

  function beginAdding() {
    setEditingId(null);
    setRemovingId(null);
    setNewRepo("");
    setNewName("");
    setNewPath("master_plan.md");
    setNewBranch("main");
    setAddError("");
    setShowAdd(true);
  }

  function beginEditing(project: Project) {
    setEditingId(project.id);
    setRemovingId(null);
    setNewRepo(project.repo);
    setNewName(project.name);
    setNewPath(project.path);
    setNewBranch(project.branch);
    setAddError("");
    setShowAdd(true);
  }

  function closeForm() {
    setShowAdd(false);
    setEditingId(null);
    setAddError("");
  }

  function submitVoyage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError("");
    try {
      const updated = saveVoyage(projects, {
        repo: newRepo, name: newName, path: newPath, branch: newBranch
      }, editingId);
      persistProjects(updated.projects);
      setActiveId(updated.activeId);
      initializedMap.current = "";
      setSnapshot(null);
      setSelected(null);
      setRecentChanges([]);
      setQuestsOpen(false);
      setTick(value => value + 1);
      closeForm();
    } catch (reason) {
      setAddError(reason instanceof Error ? reason.message : "Check the repository and roadmap details.");
    }
  }

  function confirmRemoval(project: Project) {
    const updated = removeVoyage(projects, project.id, activeId);
    persistProjects(updated.projects);
    setRemovingId(null);
    if (editingId === project.id) closeForm();
    if (activeId === project.id) {
      setActiveId(updated.activeId);
      setSnapshot(null);
      setSelected(null);
      setRecentChanges([]);
      setQuestsOpen(false);
      setFullscreen(false);
      initializedMap.current = "";
      setTick(value => value + 1);
    }
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

  function onDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.target as Element;
    const element = target.closest("[data-island]");
    const id = element?.getAttribute("data-island") || null;
    const index = islands.findIndex(island => island.id === id);
    drag.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: index >= 0 ? locations[index] : { x: 0, y: 0 },
      camera: { ...cameraRef.current },
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
    if (!gesture.moved) return;
    if (gesture.id) {
      const updated = {
        ...positionsRef.current,
        [gesture.id]: clampIsland({
          x: gesture.origin.x + dx / zoomRef.current,
          y: gesture.origin.y + dy / zoomRef.current
        }, mapWidth, mapHeight)
      };
      positionsRef.current = updated;
      setPositions(updated);
    } else {
      setCameraPosition(panCamera(gesture.camera, dx, dy));
    }
  }

  function onUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.id && !gesture.moved) selectIsland(gesture.id);
    if (gesture.id && gesture.moved) {
      try { localStorage.setItem(layoutPrefix + active.repo, JSON.stringify(positionsRef.current)); } catch { /* non-fatal */ }
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onMapKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return;
    const offsets: Record<string, Location> = {
      ArrowLeft: { x: 75, y: 0 },
      ArrowRight: { x: -75, y: 0 },
      ArrowUp: { x: 0, y: 75 },
      ArrowDown: { x: 0, y: -75 }
    };
    const delta = offsets[event.key];
    if (!delta) return;
    event.preventDefault();
    setCameraPosition(panCamera(cameraRef.current, delta.x, delta.y));
  }

  function resetLayout() {
    positionsRef.current = {};
    setPositions({});
    try { localStorage.removeItem(layoutPrefix + active.repo); } catch { /* non-fatal */ }
    requestAnimationFrame(() => fitMap());
  }

  function renderGuide(source: string) {
    return <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const resolved = resolveRoadmapHref(active, href);
          return resolved
            ? <a href={resolved} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>;
        },
        img: ({ src, alt }) => {
          // External embedded images can track readers of imported roadmaps.
          // Link to the source instead of automatically loading them.
          const resolved = resolveRoadmapHref(active, typeof src === "string" ? src : undefined);
          return resolved
            ? <a href={resolved} target="_blank" rel="noopener noreferrer">View illustration: {alt || "Image"} ↗</a>
            : <span>Image reference unavailable</span>;
        }
      }}
    >{source}</ReactMarkdown>;
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
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedNotice({ id: task.id, ok: true });
    } catch {
      setCopiedNotice({ id: task.id, ok: false });
    }
  }

  return (
    <div className="shell">
      <aside className="fleet">
        <div className="brand"><span className="brand-emblem">✧</span><div><strong>VOYAGES</strong><small>PROJECT CARTOGRAPHY</small></div></div>
        <div className="fleet-heading">THE FLEET <span>{projects.length} voyage{projects.length === 1 ? "" : "s"}</span></div>
        <div className="project-list">
          {projects.map(project => (
            <div key={project.id} className={"fleet-entry" + (active.id === project.id ? " fleet-selected" : "")}>
              <button type="button" className={"project-choice " + (active.id === project.id ? "active" : "")}
                onClick={() => {
                  initializedMap.current = "";
                  setRecentChanges([]);
                  setActiveId(project.id);
                  setSnapshot(null);
                  setSelected(null);
                  setQuestsOpen(false);
                }}>
                <span className="project-crest">⚓</span>
                <span><strong>{project.name}</strong><small>{project.repo}</small></span>
                {active.id === project.id && <span className="choice-chevron">›</span>}
              </button>
              <div className="fleet-entry-actions">
                <button type="button" aria-label={"Edit voyage " + project.name}
                  onClick={() => beginEditing(project)}>Edit</button>
                <button type="button" aria-label={"Remove voyage " + project.name}
                  onClick={() => { setRemovingId(project.id); if (editingId === project.id) closeForm(); }}>Remove</button>
              </div>
              {removingId === project.id && <div className="remove-confirm" role="group" aria-label={"Confirm removal of " + project.name}>
                <p>Remove <strong>{project.name}</strong> from this browser? Your GitHub repository will not be changed.</p>
                <div>
                  <button type="button" onClick={() => setRemovingId(null)}>Cancel</button>
                  <button type="button" className="confirm-delete" onClick={() => confirmRemoval(project)}>Remove voyage</button>
                </div>
              </div>}
            </div>
          ))}
        </div>
        <button className="new-voyage" type="button" onClick={() => {
          if (showAdd && !editingId) closeForm();
          else beginAdding();
        }}>＋ Chart a new voyage</button>
        {showAdd && (
          <form className="add-form" onSubmit={submitVoyage}>
            <strong>{editingId ? "EDIT VOYAGE" : "CHART A NEW VOYAGE"}</strong>
            <label>Repository <input required placeholder="owner/repo" value={newRepo}
              onChange={event => setNewRepo(event.target.value)} /></label>
            <label>Display name <input placeholder="Project name" value={newName}
              onChange={event => setNewName(event.target.value)} /></label>
            <label>Markdown roadmap <input required placeholder="master_plan.md" value={newPath}
              onChange={event => setNewPath(event.target.value)} /></label>
            <label>Branch <input required value={newBranch} onChange={event => setNewBranch(event.target.value)} /></label>
            <small>Public GitHub repositories only. Use the exact path to the .md file.</small>
            {addError && <p className="form-error" role="alert">{addError}</p>}
            <div className="fleet-form-actions">
              <button className="action-button" type="submit">{editingId ? "Save voyage" : "Add voyage"}</button>
              <button className="fleet-cancel" type="button" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        )}
        <div className="fleet-foot">
          <span className="compass-mini">✥</span>
          <p>Your GitHub roadmaps are the source of truth. Your map remembers where you left off.</p>
        </div>
      </aside>

      <main className="workspace">
        {projects.length === 0 ? <div className="empty-fleet">
          <span className="empty-compass" aria-hidden="true">✥</span>
          <h1>Your fleet is empty</h1>
          <p>Chart a new voyage by connecting a public GitHub repository and selecting its Markdown roadmap.</p>
          <button className="action-button" type="button" onClick={beginAdding}>Add your first voyage</button>
        </div> : <>
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

        <section className={"atlas-panel" + (fullscreen ? " atlas-fullscreen" : "")} aria-label="Interactive voyage map">
          <div className="atlas-top">
            <div><span className="eyebrow">YOUR CHARTED COURSE</span><h2>The expedition map</h2></div>
            <div className="map-actions">
              <span className="sync-stamp">{snapshot ? "Last checked " + new Date(snapshot.updatedAt).toLocaleTimeString() : "Awaiting chart"}</span>
              <button type="button" aria-label="Zoom out" onClick={() => changeZoom(-.14)}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="Zoom in" onClick={() => changeZoom(.14)}>＋</button>
              <button type="button" onClick={fitMap}>Whole map</button>
              <button type="button" disabled={!islands.length} onClick={() => {
                const next = islands.find(island => island.tasks.length > 0 && island.progress < 100) || islands[islands.length - 1];
                if (next) focusOnIsland(next.id);
              }}>Find my ship</button>
              <select className="island-jump" aria-label="Navigate to an island" defaultValue="" key={active.repo + islands.length}
                onChange={event => { if (event.target.value) focusOnIsland(event.target.value, true); event.target.value = ""; }}>
                <option value="">Jump to island…</option>
                {islands.map(island => <option key={island.id} value={island.id}>{island.number + 1}. {island.name}</option>)}
              </select>
              <button type="button" onClick={resetLayout}>Reset islands</button>
              <button type="button" className="fullscreen-toggle" aria-pressed={fullscreen} onClick={toggleFullscreen}>
                {fullscreen ? "⤡ Exit full screen" : "⛶ Full screen"}
              </button>
              <button className="map-quest-toggle" aria-expanded={questsOpen} onClick={toggleQuests}>
                {questsOpen ? "Hide quests" : "Show quests"}
              </button>
            </div>
          </div>
          {error && <div className="error-banner">Could not fetch roadmap: {error} <button onClick={() => setTick(t => t + 1)}>Retry</button></div>}
          {!loading && !error && snapshot && islands.length === 0 && <div className="loading-banner">
            No islands were found. Your Markdown needs headings such as <code># Phase 0 — Planning</code> or <code>## M1: Planning</code>.
          </div>}
          {!error && loading && !snapshot && <div className="loading-banner">Unrolling the charts and finding your islands…</div>}
          <div className="map-scroll" ref={mapViewport} tabIndex={0} role="region"
            aria-label="Pan and zoom the project archipelago" onKeyDown={onMapKeyDown}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
            <svg className="treasure-map" viewBox={"0 0 " + mapWidth + " " + mapHeight}
              style={{ width: mapWidth, height: mapHeight,
                transform: "translate(" + camera.x + "px, " + camera.y + "px) scale(" + zoom + ")" }}
              aria-label="Draggable treasure map of project milestones">
              <defs>
                <pattern id="waves" width="150" height="130" patternUnits="userSpaceOnUse">
                  <path d="M12 35q11 -6 23 0m24 55q11 -6 23 0m61 -60q9 -5 20 0" fill="none" stroke="#5b756c" strokeWidth="1" opacity=".23" />
                </pattern>
                <pattern id="graticule" width="120" height="120" patternUnits="userSpaceOnUse">
                  <path d="M120 0H0V120" fill="none" stroke="#796f50" opacity=".11" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={mapWidth} height={mapHeight} fill="#d9d1ad" />
              <rect width={mapWidth} height={mapHeight} fill="url(#graticule)" />
              <rect width={mapWidth} height={mapHeight} fill="url(#waves)" />
              <path d={"M 35 35 H " + (mapWidth - 35) + " V " + (mapHeight - 35) + " H 35 Z"} fill="none" stroke="#847454" strokeWidth="1.3" opacity=".55" />
              <g transform="translate(125 96)" opacity=".66">
                <circle r="50" stroke="#53422f" strokeWidth="1" fill="none" />
                <circle r="37" stroke="#53422f" strokeWidth=".5" fill="none" />
                <path d="M0-62L9-10L63 0L9 10L0 62L-9 10L-63 0L-9-10Z" fill="#604934" />
                <path d="M0-50L5 0L0 50L-5 0Z" fill="#e8dfbd" />
                <text y="-67" textAnchor="middle" fontSize="20">N</text><text x="72" y="6" fontSize="16">E</text>
                <text y="82" textAnchor="middle" fontSize="16">S</text><text x="-84" y="6" fontSize="16">W</text>
              </g>
              <text x={mapWidth * .46} y="99" textAnchor="middle" className="map-sea-title">THE UNCHARTED WATERS</text>
              <text x={mapWidth * .51} y={mapHeight * .50} textAnchor="middle" className="map-sea-subtitle">THE CORAL SEA</text>
              <text x={mapWidth * .69} y={mapHeight - 90} textAnchor="middle" className="map-sea-subtitle">FORTUNE FAVOURS THE STEADFAST</text>
              <g transform={"translate(" + (mapWidth - 175) + " " + (mapHeight - 130) + ")"} opacity=".37">
                <path d="M-50 22 Q-25 0 4 20 Q28 2 51 22 M-42 35Q-19 14 3 35Q29 18 48 35" fill="none" stroke="#5e6a5c" strokeWidth="1.4"/>
                <path d="M-30 3h71l-13 17h-48z M5 0v-67l-34 60H5l32-36-32-15 M5-65v-8 M5-73l21 5-21 5"
                  fill="none" stroke="#514638" strokeWidth="2" />
              </g>
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
                    <IslandSketch variant={index} state={status} isFinal={index === islands.length - 1} />
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
          <div className="map-bottom"><span><i className="legend-dot done-dot" />Completed</span><span><i className="legend-dot current-dot" />Your current island</span><span><i className="legend-dot future-dot" />Upcoming</span><span className="drag-hint">Drag anywhere to pan · Wheel/trackpad to travel · Ctrl + wheel to zoom · Drag islands to arrange · Click to explore</span></div>
        </section>

        <section className="below-grid">
          <article className="paper-card">
            <div className="card-heading"><div><small className="eyebrow">THE SHIP&apos;S LOG</small><h2>Recent chart updates</h2></div><a href={"https://github.com/" + active.repo + "/commits/" + encodeURIComponent(active.branch) + "/" + active.path} target="_blank" rel="noreferrer">GitHub ↗</a></div>
            {recentChanges.length > 0 && <div className="local-activity">
              <strong>Checklist changes detected since earlier visits</strong>
              {recentChanges.slice(0, 5).map((change, index) =>
                <div key={change.detectedAt + change.key + index} className="activity">
                  <div className="activity-bullet" aria-hidden="true">{change.kind === "completed" ? "✓" : "↺"}</div>
                  <div><span className="task-change-title">{change.kind === "completed" ? "Quest completed" : "Quest reopened"}: {change.title}</span>
                    <small>{change.phase} · Detected {timeAgo(change.detectedAt)}</small></div>
                </div>
              )}
              <p className="subtle-note">Saved in this browser when GitHub synchronization detects a checkbox change. Detection time is not commit time.</p>
            </div>}
            {snapshot?.activity.length ? snapshot.activity.map(item => <div className="activity" key={item.id}>
              <div className="activity-bullet">✦</div><div><a href={item.url} target="_blank" rel="noreferrer">{item.message}</a><small>{item.author} · {timeAgo(item.date)}</small></div>
            </div>) : <p className="empty-note">Roadmap commit history will appear here when GitHub is available.</p>}
            <p className="subtle-note">This feed shows actual roadmap commits, not unverified task-completion claims.</p>
          </article>
          <article className="paper-card">
            <div className="card-heading"><div><small className="eyebrow">YOUR NEXT LANDFALL</small><h2>Upcoming quests</h2></div></div>
            {islands.filter(i => i.tasks.length > 0 && i.progress < 100).slice(0, 3).map(island => (
              <button className="next-island" key={island.id} onClick={() => selectIsland(island.id)}>
                <span className="quest-stamp">✧</span><span><strong>{island.name}</strong><small>{island.tasks.length - island.completed} quests remaining · {island.progress}% charted</small></span><b>↗</b>
              </button>
            ))}
            {islands.length > 0 && islands.every(i => i.progress === 100) && <p className="empty-note">Every island has been charted. Your expedition is complete.</p>}
          </article>
        </section>
        </>}
      </main>

      {projects.length > 0 && islands.length > 0 && <button
        type="button"
        className={"quest-edge-tab " + (questsOpen && selectedIsland ? "tab-open" : "tab-closed")}
        aria-controls="quest-panel"
        aria-expanded={Boolean(questsOpen && selectedIsland)}
        aria-label={questsOpen && selectedIsland ? "Hide quest panel" : "Open quest panel"}
        onClick={toggleQuests}>
        <span aria-hidden="true" className="quest-tab-symbol">{questsOpen && selectedIsland ? "›" : "‹"}</span>
        <span>{questsOpen && selectedIsland ? "HIDE QUESTS" : "OPEN QUESTS"}</span>
      </button>}
      {projects.length > 0 && questsOpen && selectedIsland && <aside id="quest-panel" className="quest-drawer" aria-label="Selected island quests">
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
                      {renderGuide(task.instructions.join("\n"))}
                    </div>
                  </> : <p className="detail-disclosure">The roadmap does not contain separate step-by-step instructions specifically for this quest. The following section work plan and source notes are provided as context.</p>}
                  {guide?.notes && <div className="detail-block">
                    <h4>{guide.title === "Overview" ? "Roadmap context" : guide.title + " — source notes"}</h4>
                    <div className="markdown-guide">
                      {renderGuide(guide.notes)}
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
                    <button type="button" onClick={() => void copyBrief(task)}>
                      {copiedNotice?.id === task.id ? (copiedNotice.ok ? "Copied to clipboard ✓" : "Copy unavailable — use source link") : "Copy task brief"}
                    </button>
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
