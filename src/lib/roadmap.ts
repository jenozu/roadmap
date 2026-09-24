export type Task = {
  id: string;
  title: string;
  done: boolean;
  section: string;
  line: number;
};

export type Island = {
  id: string;
  number: number;
  name: string;
  goal: string;
  tasks: Task[];
  completed: number;
  progress: number;
  xp: number;
};

export type Voyage = {
  title: string;
  islands: Island[];
  taskCount: number;
  completedCount: number;
  progress: number;
  xp: number;
  level: number;
};

const phasePattern = /^#\s+Phase\s+(\d+)\s*[-:—–]\s*(.+)$/i;
const taskPattern = /^\s*[-*]\s+\[([xX ])\]\s+(.+)$/;
const idPattern = /<!--\s*task:([a-z0-9_-]+)\s*-->/i;

export function parseRoadmap(markdown: string): Voyage {
  const lines = markdown.split(/\r?\n/);
  const islands: Island[] = [];
  let current: Island | undefined;
  let section = "General";
  let readingGoal = false;
  let inFence = false;
  let title = "New voyage";

  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i].trim();
    if (/^```/.test(text) || /^~~~/.test(text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (i === 0 && /^#\s+/.test(text)) title = text.replace(/^#\s+/, "");
    const match = text.match(phasePattern);
    if (match) {
      current = {
        id: "phase-" + match[1],
        number: Number(match[1]),
        name: match[2].trim(),
        goal: "",
        tasks: [],
        completed: 0,
        progress: 0,
        xp: 0
      };
      islands.push(current);
      section = "General";
      readingGoal = false;
      continue;
    }
    if (!current) continue;
    const heading = text.match(/^#{2,5}\s+(.+)$/);
    if (heading) {
      section = heading[1].trim();
      readingGoal = /^goal$/i.test(section);
      continue;
    }
    if (readingGoal && text && !text.startsWith(">") && !current.goal) {
      current.goal = text;
      readingGoal = false;
    }
    const task = lines[i].match(taskPattern);
    if (task) {
      const raw = task[2].trim();
      const explicitId = raw.match(idPattern);
      const label = raw.replace(idPattern, "").trim();
      current.tasks.push({
        id: explicitId ? explicitId[1] : current.id + "-line-" + (i + 1),
        title: label,
        done: task[1].toLowerCase() === "x",
        section,
        line: i + 1
      });
    }
  }
  islands.sort((a, b) => a.number - b.number);
  let done = 0;
  let total = 0;
  for (const island of islands) {
    island.completed = island.tasks.filter(t => t.done).length;
    island.progress = island.tasks.length ? Math.round(island.completed / island.tasks.length * 100) : 0;
    island.xp = island.completed * 10 + (island.tasks.length > 0 && island.completed === island.tasks.length ? 150 : 0);
    done += island.completed;
    total += island.tasks.length;
  }
  const xp = islands.reduce((sum, island) => sum + island.xp, 0);
  return {
    title,
    islands,
    taskCount: total,
    completedCount: done,
    progress: total ? Math.round(done / total * 100) : 0,
    xp,
    level: Math.floor(xp / 500) + 1
  };
}
