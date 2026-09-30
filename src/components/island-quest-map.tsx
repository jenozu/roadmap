"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Island, Task } from "@/lib/roadmap";
import { checkpointLayout, currentTaskIndex } from "@/lib/island-quest-layout";

type Props = {
  island: Island;
  sourceUrl: string;
  syncedAt?: string;
  onBack: () => void;
};

function routePath(points: { x: number; y: number }[]): string {
  return points.map((point, index) => {
    if (index === 0) return "M " + point.x + " " + point.y;
    const prior = points[index - 1];
    const middle = (prior.x + point.x) / 2;
    return " C " + middle + " " + prior.y + ", " + middle + " " + point.y + ", " + point.x + " " + point.y;
  }).join("");
}

export default function IslandQuestMap({ island, sourceUrl, syncedAt, onBack }: Props) {
  const currentIndex = currentTaskIndex(island.tasks.map(task => task.done));
  const [focusedIndex, setFocusedIndex] = useState(currentIndex);
  const map = useMemo(() => checkpointLayout(island.tasks.length), [island.tasks.length]);
  const complete = island.tasks.length > 0 && island.tasks.every(task => task.done);
  const focused = island.tasks[focusedIndex] || island.tasks[currentIndex];

  // When a repository push completes the current task, immediately move the
  // focus to the newly-current checkpoint instead of leaving stale context.
  useEffect(() => {
    setFocusedIndex(currentIndex);
  }, [currentIndex, island.id]);

  const clue = { x: map.width / 2, y: map.height - 95 };
  const fullPath = routePath([...map.points, clue]);
  const h = map.height;
  // The island coastline expands with the number of task rows. The previous
  // fixed 620px silhouette caused long checkpoint trails to spill into the sea.
  const coast = [
    "M 82 105",
    "Q 165 32 300 76",
    "Q 430 20 555 78",
    "Q 715 28 875 82",
    "Q 970 118 964 238",
    "Q 950 330 964 " + Math.max(390, h * .42),
    "L 964 " + Math.max(420, h - 245),
    "Q 985 " + (h - 125) + " 858 " + (h - 68),
    "Q 720 " + (h - 22) + " 585 " + (h - 72),
    "Q 455 " + (h - 18) + " 315 " + (h - 66),
    "Q 165 " + (h - 22) + " 88 " + (h - 132),
    "Q 40 " + (h - 245) + " 75 " + (h - 355),
    "Q 42 210 82 105 Z"
  ].join(" ");

  return <div className="island-view" data-island-view={island.id}>
    <div className="island-view-bar">
      <div>
        <small>ISLAND {String(island.number + 1).padStart(2, "0")} · LOCAL CHART</small>
        <h2>{island.name}</h2>
      </div>
      <div className="island-view-actions">
        <span className="live-sync-dot">●</span>
        <span>Watching GitHub{syncedAt ? " · " + new Date(syncedAt).toLocaleTimeString() : ""}</span>
        <button type="button" onClick={onBack}>← Back to world map</button>
      </div>
    </div>

    <div className="island-local-layout">
      <div className="island-local-scroll">
        <svg className="island-local-map" viewBox={"0 0 " + map.width + " " + map.height}
          role="img" aria-label={"Task checkpoints for " + island.name}>
          <defs>
            <pattern id="local-hatch" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M0 18Q6 13 12 18T24 18" fill="none" stroke="#7d7654" strokeWidth=".7" opacity=".18"/>
            </pattern>
          </defs>
          <rect width={map.width} height={map.height} fill="#d9d0ab"/>
          <rect width={map.width} height={map.height} fill="url(#local-hatch)"/>
          <path d={coast} fill="#beb792" stroke="#625b43" strokeWidth="3"/>
          <path d={"M150 " + Math.round(h * .36) + " Q245 " + Math.round(h * .30) + " 340 " + Math.round(h * .36) +
            " T530 " + Math.round(h * .33) + " T705 " + Math.round(h * .38) + " T890 " + Math.round(h * .31)}
            fill="none" stroke="#7c7557" strokeWidth="1.5" opacity=".35"/>
          <path d={fullPath} fill="none" stroke="#76503a" strokeWidth="4" strokeDasharray="3 15" strokeLinecap="round"/>
          <g opacity=".35" stroke="#4f533e" fill="none">
            <path d="M132 246q28-64 57 0m-29-45v-54m0 7-28-18m28 18 29-22"/>
            <path d="M828 205l22-55 25 55m-37-24h48"/>
            <path d={"M470 " + (h - 155) + " q26-34 52 0m-40 0v-36h28v36"}/>
          </g>
          {map.points.map((point, index) => {
            const task = island.tasks[index];
            const isCurrent = !complete && index === currentIndex;
            const isFocused = index === focusedIndex;
            const state = task.done ? "done" : isCurrent ? "current" : "upcoming";
            return <g key={task.id} data-checkpoint={task.id} transform={"translate(" + point.x + " " + point.y + ")"}
              role="button" tabIndex={0}
              aria-label={"Checkpoint " + (index + 1) + ": " + task.title + (isCurrent ? ", current task" : "")}
              className={"local-checkpoint " + state + (isFocused ? " focused" : "")}
              onClick={() => setFocusedIndex(index)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocusedIndex(index); } }}>
              {isFocused && <circle r="31" fill="none" stroke="#805d3b" strokeWidth="2" strokeDasharray="3 5"/>}
              <circle r="22" className="checkpoint-circle"/>
              <text textAnchor="middle" dy="6" className="checkpoint-number">{task.done ? "✓" : index + 1}</text>
              {isCurrent && <path d="M0-38L-8-51H8Z" fill="#3d7888"/>}
            </g>;
          })}
          <g transform={"translate(" + clue.x + " " + clue.y + ")"} className={"clue-marker " + (complete ? "unlocked" : "locked")}>
            <path d="M-28 12h56v33h-56zM-19 12v-15Q-19-28 0-28Q19-28 19-3v15" fill="none" stroke="currentColor" strokeWidth="3"/>
            <text textAnchor="middle" y="65">{complete ? "CLUE UNLOCKED" : "FINAL CLUE"}</text>
          </g>
        </svg>
      </div>

      <aside className="current-task-card" aria-live="polite">
        {complete ? <>
          <div className="current-task-kicker">ISLAND COMPLETE</div>
          <h3>The final clue is yours.</h3>
          <p>Every checkpoint on this island is complete. Return to the world map and continue to the next island.</p>
          <div className="clue-box">✦ Course revealed: the next island is now your active destination.</div>
          <button type="button" className="action-button" onClick={onBack}>Continue voyage →</button>
        </> : focused ? <TaskFocus task={focused} current={focusedIndex === currentIndex} sourceUrl={sourceUrl} /> : <>
          <h3>No task checkpoints yet</h3>
          <p>Add checklist items to this milestone in the repository roadmap.</p>
        </>}
      </aside>
    </div>
  </div>;
}

function TaskFocus({ task, current, sourceUrl }: { task: Task; current: boolean; sourceUrl: string }) {
  return <>
    <div className="current-task-kicker">{current ? "CURRENT QUEST" : task.done ? "COMPLETED QUEST" : "UPCOMING QUEST"}</div>
    <h3>{task.title}</h3>
    <div className="current-task-meta">
      <span>{task.section}</span>
      <span>{task.done ? "Completed" : current ? "In progress" : "Not started"}</span>
    </div>
    {task.instructions.length ? <div className="current-task-instructions">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.instructions.join("\n")}</ReactMarkdown>
    </div> : <p className="current-task-empty">No separate step-by-step instructions are nested under this task. Open the source roadmap for its surrounding context.</p>}
    <a className="task-source-button" href={sourceUrl + "#L" + task.line} target="_blank" rel="noreferrer">Open task in GitHub ↗</a>
  </>;
}
