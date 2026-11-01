import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceSkeleton } from "@/app/WorkspaceSkeleton";
import { parseDoc } from "@/editor/useEditor";
import { Home } from "@/pages/home/Home";
import { Trash } from "@/pages/trash/Trash";
import { AppShell, type Page } from "@/app/AppShell";
import { useReminders } from "@/pages/planner/reminders";
import { Brands } from "@/pages/brands/Brands";
import { Planner } from "@/pages/planner/Planner";
import { api, type ProjectInfo } from "@/shared/api";
import { Workspace, type Preloaded } from "@/editor/Workspace";

const initialProject = () => new URLSearchParams(location.search).get("p");
const initialTrash = () => new URLSearchParams(location.search).has("trash");
const initialBrands = () => new URLSearchParams(location.search).has("brands");
const initialPlan = () => new URLSearchParams(location.search).has("plan");

export function App() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const [project, setProject] = useState<string | null>(initialProject);
  const [trash, setTrash] = useState(initialTrash);
  const [brands, setBrands] = useState(initialBrands);
  const [plan, setPlan] = useState(initialPlan);
  useReminders();

  const refresh = useCallback(async () => {
    const list = await api.list();
    setProjects(list);
    return list;
  }, []);

  const [preloaded, setPreloaded] = useState<Preloaded>();
  const switchSeq = useRef(0);

  // Load the target first and keep the current workspace on screen meanwhile, so there is no blank flash.
  const load = useCallback(async (id: string) => {
    const seq = ++switchSeq.current;
    try {
      const text = await (await fetch(`/api/projects/${encodeURIComponent(id)}`)).text();
      if (seq !== switchSeq.current) return false;
      setPreloaded({ id, text, doc: parseDoc(text) });
    } catch {
      if (seq !== switchSeq.current) return false;
    }
    setProject(id);
    return true;
  }, []);

  const switchTo = useCallback(async (id: string) => {
    if (id === project) return;
    if (await load(id)) history.pushState(null, "", `?p=${encodeURIComponent(id)}`);
  }, [load, project]);

  const goPage = useCallback((page: Page) => {
    switchSeq.current++; // drop any in-flight project load
    history.pushState(null, "", page === "home" ? location.pathname : `?${{ plan: "plan", brands: "brands", trash: "trash" }[page]}=1`);
    setTrash(page === "trash");
    setBrands(page === "brands");
    setPlan(page === "plan");
    setProject(null);
    refresh().catch(() => {});
  }, [refresh]);
  const goHome = useCallback(() => goPage("home"), [goPage]);

  useEffect(() => {
    if (project) localStorage.setItem("carousel-last-project", project);
  }, [project]);

  // "Buka" action on the AI-finished toast
  useEffect(() => {
    const open = (e: Event) => { setTrash(false); setBrands(false); setPlan(false); switchTo((e as CustomEvent<string>).detail); };
    window.addEventListener("carousel:open", open);
    return () => window.removeEventListener("carousel:open", open);
  }, [switchTo]);

  // clicking a browser notification for a plan reminder
  useEffect(() => {
    const open = () => goPage("plan");
    window.addEventListener("carousel:plan", open);
    return () => window.removeEventListener("carousel:plan", open);
  }, [goPage]);

  useEffect(() => {
    (async () => {
      await refresh();
    })();
    const onPop = () => {
      const id = initialProject();
      setTrash(initialTrash());
      setBrands(initialBrands());
      setPlan(initialPlan());
      if (id) load(id);
      else { switchSeq.current++; setProject(null); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [refresh, load]);

  // slide counts in the dropdown drift as agents/edits change things
  useEffect(() => {
    const t = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!projects) return <WorkspaceSkeleton />;
  if (!project) {
    const page: Page = trash ? "trash" : brands ? "brands" : plan ? "plan" : "home";
    return (
      <AppShell page={page} onNav={goPage}>
        {page === "trash" ? <Trash onChanged={refresh} />
          : page === "brands" ? <Brands projects={projects} />
          : page === "plan" ? <Planner projects={projects} onOpen={(id) => { setPlan(false); switchTo(id); }} />
          : <Home projects={projects} onOpen={switchTo} onPlan={() => goPage("plan")} onBrands={() => goPage("brands")} onChanged={refresh} />}
      </AppShell>
    );
  }
  return <Workspace key={project} project={project} preloaded={preloaded} projects={projects} onSwitch={switchTo} onHome={goHome} onProjectsChanged={refresh} />;
}

