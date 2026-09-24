export type Task = {
  id: string;
  title: string;
  done: boolean;
  section: string;
  sectionId: string;
  line: number;
  // Task-specific detail exists only when it is explicitly indented beneath the checkbox.
  instructions: string[];
};

export type SectionGuide = {
  id: string;
  title: string;
  line: number;
  // The original surrounding prose, code examples and references from the roadmap.
  notes: string;
};

export type Island = {
  id: string;
  number: number;
  name: string;
  goal: string;
  sections: SectionGuide[];
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
const taskPattern = /^(\s*)[-*]\s+\[([xX ])\]\s+(.+)$/;
const idPattern = /<!--\s*task:([a-z0-9_-]+)\s*-->/i;

export function parseRoadmap(markdown: string): Voyage {
  const lines = markdown.split(/\r?\n/);
  const islands: Island[] = [];
  let current: Island | undefined;
  let section: SectionGuide | undefined;
  let sectionLines: string[] = [];
  let goalSection = false;
  let activeTask: Task | undefined;
  let activeIndent = 0;
  let fence: string | undefined;
  let title = "New voyage";

  function flushSection() {
    if (section) section.notes = sectionLines.join("\n").trim();
    sectionLines = [];
    activeTask = undefined;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const text = line.trim();
    const fenceMark = text.match(/^(\x60{3,}|~{3,})/);
    if (fenceMark) {
      // Keep real code samples visible in the detail panel but never parse
      // fake example checkboxes or milestone headers from inside a fence.
      if (!fence) fence = fenceMark[1][0];
      else if (fence === fenceMark[1][0]) fence = undefined;
      if (section) sectionLines.push(line);
      if (activeTask && line.match(/^\s*/)?.[0].length! > activeIndent) {
        activeTask.instructions.push(line);
      }
      continue;
    }
    if (fence) {
      if (section) sectionLines.push(line);
      if (activeTask && (line.match(/^\s*/)?.[0].length ?? 0) > activeIndent) {
        activeTask.instructions.push(line);
      }
      continue;
    }
    if (i === 0 && /^#\s+/.test(text)) title = text.replace(/^#\s+/, "");
    const phase = text.match(phasePattern);
    if (phase) {
      flushSection();
      current = {
        id: "phase-" + phase[1],
        number: Number(phase[1]),
        name: phase[2].trim(),
        goal: "",
        sections: [],
        tasks: [],
        completed: 0,
        progress: 0,
        xp: 0
      };
      islands.push(current);
      section = {
        id: current.id + "-intro",
        title: "Overview",
        line: i + 1,
        notes: ""
      };
      current.sections.push(section);
      goalSection = false;
      continue;
    }
    if (!current) continue;

    const heading = text.match(/^#{2,5}\s+(.+)$/);
    if (heading) {
      flushSection();
      const nextTitle = heading[1].trim();
      section = {
        id: current.id + "-section-" + current.sections.length,
        title: nextTitle,
        line: i + 1,
        notes: ""
      };
      current.sections.push(section);
      goalSection = /^goal$/i.test(nextTitle);
      continue;
    }

    const task = line.match(taskPattern);
    if (task) {
      const raw = task[3].trim();
      const explicitId = raw.match(idPattern);
      const label = raw.replace(idPattern, "").trim();
      const item: Task = {
        id: explicitId ? explicitId[1] : current.id + "-line-" + (i + 1),
        title: label,
        done: task[2].toLowerCase() === "x",
        section: section?.title || "Overview",
        sectionId: section?.id || current.id + "-intro",
        line: i + 1,
        instructions: []
      };
      if (activeTask && task[1].length > activeIndent) {
        activeTask.instructions.push(line);
      }
      current.tasks.push(item);
      activeTask = item;
      activeIndent = task[1].length;
      continue;
    }

    if (goalSection && text && !text.startsWith(">")) {
      current.goal = current.goal ? current.goal + " " + text : text;
    }
    if (section) sectionLines.push(line);
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (activeTask && text && indent > activeIndent) {
      activeTask.instructions.push(line);
    } else if (activeTask && text && indent <= activeIndent) {
      activeTask = undefined;
    } else if (activeTask && activeTask.instructions.length && !text) {
      activeTask.instructions.push("");
    }
  }
  flushSection();

  // Preserve the order from the file within each milestone and each section.
  // Only distinct phase numbers are sorted for map routing.
  islands.sort((a, b) => a.number - b.number);
  let completedCount = 0;
  let taskCount = 0;
  for (const island of islands) {
    for (const task of island.tasks) {
      task.instructions = task.instructions.map(line => line.replace(/^\s{2}/, "")).join("\n").trim()
        ? task.instructions.filter((line, index, rows) => line.trim() || (index > 0 && rows[index - 1].trim()))
        : [];
    }
    island.completed = island.tasks.filter(task => task.done).length;
    island.progress = island.tasks.length ? Math.round(island.completed / island.tasks.length * 100) : 0;
    island.xp = island.completed * 10 + (island.tasks.length > 0 && island.completed === island.tasks.length ? 150 : 0);
    completedCount += island.completed;
    taskCount += island.tasks.length;
  }
  const xp = islands.reduce((sum, island) => sum + island.xp, 0);
  return {
    title,
    islands,
    taskCount,
    completedCount,
    progress: taskCount ? Math.round(completedCount / taskCount * 100) : 0,
    xp,
    level: Math.floor(xp / 500) + 1
  };
}
