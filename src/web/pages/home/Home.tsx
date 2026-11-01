import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, Plus, Search, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FORMATS, type Carousel } from "../../../core/schema";
import { api, exportMany, exportProject, uploadAsset, type ExportOpts, type ProjectInfo } from "@/shared/api";
import { AiCreate } from "@/pages/home/AiCreate";
import { HomeCards } from "@/pages/home/HomeCards";
import { FilterChips, type Filter } from "@/pages/home/FilterChips";
import { Preview } from "@/editor/present/Preview";
import { SelectionBar } from "@/pages/home/SelectionBar";
import { useDialogs, validateProjectId } from "@/app/dialogs";
import { NewProjectDialog, type NewProject } from "@/pages/home/NewProjectDialog";
import { NoProjectsArt, NoResultsArt } from "@/pages/home/HomeEmptyArt";
import { PageHeader } from "@/shared/PageHeader";
import { ThemeToggle } from "@/app/ThemeToggle";
import { setViewing, useRunning } from "@/editor/ai/agentRuns";
import { parseDoc } from "@/editor/useEditor";
import { Hero } from "@/pages/home/Hero";
import { Card, Row } from "@/pages/home/ProjectItems";
import { PAGE, PINS_KEY, greeting, groupProjects, loadPins, summary, type ActivateFn, type Action, type Group, type Sort, type View } from "@/pages/home/homeData";


export function Home({ projects, onOpen, onPlan, onBrands, onChanged }: {
  projects: ProjectInfo[];
  onOpen: (id: string) => void;
  onPlan: () => void;
  onBrands: () => void;
  onChanged: () => Promise<ProjectInfo[]>;
}) {
  const { ask, confirm } = useDialogs();
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<{ id: string; doc: Carousel } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setViewing(null); }, []);
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("carousel-home-sort") === "name" ? "name" : "recent"));
  const [view, setView] = useState<View>(() => (localStorage.getItem("carousel-home-view") === "list" ? "list" : "grid"));
  const [pins, setPins] = useState<string[]>(loadPins);
  const [filter, setFilter] = useState<Filter>("all");
  const running = useRunning();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const lastSelected = useRef<string | null>(null);
  const lastOpened = localStorage.getItem("carousel-last-project");
  const hero = projects.find((p) => p.id === lastOpened) ?? projects.reduce<ProjectInfo | undefined>((a, p) => (!a || p.updated > a.updated ? p : a), undefined);

  const needle = q.trim().toLowerCase();
  const filtering = !!needle || filter !== "all";
  const groups = useMemo(() => groupProjects(projects, pins, sort, needle, filter, running), [projects, pins, sort, needle, filter, running]);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [needle, filter, sort]);
  const { shown, hidden } = useMemo(() => {
    let left = limit;
    let hidden = 0;
    const shown: Group[] = [];
    for (const g of groups) {
      if (g.key === "pin") { shown.push(g); continue; }
      const take = g.items.slice(0, Math.max(0, left));
      left -= take.length;
      hidden += g.items.length - take.length;
      if (take.length) shown.push(take.length < g.items.length ? { ...g, items: take, total: g.items.length } : g);
    }
    return { shown, hidden };
  }, [groups, limit]);
  const order = useMemo(() => shown.flatMap((g) => g.items.map((p) => p.id)), [shown]);
  const first = groups[0]?.items[0];
  const tileGroup = (groups.find((g) => g.key !== "pin") ?? groups[0])?.key;

  const persist = <T extends string>(key: string, set: (v: T) => void) => (v: T) => {
    set(v);
    localStorage.setItem(key, v);
  };
  const setSortPersist = persist<Sort>("carousel-home-sort", setSort);
  const setViewPersist = persist<View>("carousel-home-view", setView);

  const select = (id: string, range: boolean) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const from = lastSelected.current ? order.indexOf(lastSelected.current) : -1;
      if (range && from >= 0) {
        const to = order.indexOf(id);
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(order[i]);
      } else if (!next.delete(id)) next.add(id);
      return next;
    });
    lastSelected.current = id;
  };
  const activate: ActivateFn = (id, e) => {
    if (selected.size > 0 || e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      select(id, e.shiftKey);
    } else onOpen(id);
  };

  // drop selected ids that vanished (deleted, renamed elsewhere)
  useEffect(() => {
    setSelected((cur) => {
      const alive = new Set(projects.map((p) => p.id));
      const next = new Set([...cur].filter((id) => alive.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [projects]);

  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "Escape" || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.closest('[role="dialog"],[role="alertdialog"],[role="menu"]')) return;
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const bulkPin = () => {
    const ids = [...selected];
    const unpin = ids.every((id) => pins.includes(id));
    setPins((cur) => {
      const set = new Set(cur);
      ids.forEach((id) => (unpin ? set.delete(id) : set.add(id)));
      const next = [...set];
      localStorage.setItem(PINS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const bulkExport = async () => {
    const ids = [...selected].filter((id) => (projects.find((p) => p.id === id)?.slides ?? 0) > 0);
    if (!ids.length) return void toast.error("Project terpilih belum punya slide");
    const skipped = selected.size - ids.length;
    const t = toast.loading(`Export ${ids.length} project…`);
    setBulkBusy(true);
    try {
      await exportMany(ids);
      toast.success(`${ids.length} project di-export${skipped ? ` (${skipped} tanpa slide dilewati)` : ""}`, { id: t });
    } catch (e) {
      toast.error(`Export gagal: ${errMsg(e)}`, { id: t });
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!(await confirm({
      title: `Hapus ${ids.length} project?`,
      description: "Dipindahkan ke Sampah dan bisa dipulihkan dari sana.",
      confirmText: "Hapus",
      destructive: true,
    }))) return;
    setBulkBusy(true);
    try {
      for (const id of ids) await api.remove(id);
      setSelected(new Set());
      toast.success(`${ids.length} project dipindahkan ke Sampah`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      await onChanged();
      setBulkBusy(false);
    }
  };

  const togglePin = (id: string) =>
    setPins((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      localStorage.setItem(PINS_KEY, JSON.stringify(next));
      return next;
    });

  // "/" focuses search, "n" opens the new-project dialog (ignored while typing or inside a dialog)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || t.closest('[role="dialog"],[role="alertdialog"],[role="menu"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const create = async ({ id, format, from, brand }: NewProject) => {
    try {
      await api.create(id, from, from ? undefined : format);
      if (brand) await api.applyBrand(id, brand);
      await onChanged();
      setNewOpen(false);
      onOpen(id);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Drop images anywhere on the page: they become a new project, one full-bleed slide per image.
  const importImages = async (files: File[]) => {
    const taken = new Set(projects.map((p) => p.id.toLowerCase()));
    const base = (files[0].name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").replace(/^[^a-z0-9]+/i, "").slice(0, 40)) || "project-baru";
    let initial = base;
    for (let n = 2; taken.has(initial.toLowerCase()); n++) initial = `${base}-${n}`;
    const id = await ask({
      title: `Project baru dari ${files.length} gambar`,
      label: "Nama project",
      initial,
      confirmText: "Buat",
      validate: (v) => validateProjectId(v) ?? (taken.has(v.toLowerCase()) ? `"${v}" sudah ada` : null),
    });
    if (!id) return;
    const t = toast.loading("Membuat project…");
    try {
      const sizes: { name: string; w: number; h: number }[] = [];
      await api.create(id);
      for (const f of files) sizes.push(await uploadAsset(id, f));
      // closest canvas to the first image's aspect ratio
      const r = sizes[0].w / sizes[0].h;
      const format = (Object.keys(FORMATS) as Carousel["format"][]).reduce((a, b) =>
        Math.abs(FORMATS[b].width / FORMATS[b].height - r) < Math.abs(FORMATS[a].width / FORMATS[a].height - r) ? b : a);
      const doc = parseDoc(await (await fetch(`/api/projects/${encodeURIComponent(id)}`)).text());
      doc.format = format;
      doc.slides = sizes.map((z, i) => ({
        bg: "#111111",
        name: `Foto ${i + 1}`,
        elements: [{ type: "image" as const, src: `assets/${z.name}`, x: 0, y: 0, w: FORMATS[format].width, h: FORMATS[format].height, fit: "cover" as const, rotate: 0, opacity: 1, z: 0, style: {}, step: 0 }],
      }));
      await api.saveSpec(id, doc);
      await onChanged();
      toast.dismiss(t);
      onOpen(id);
    } catch (e) {
      toast.error(errMsg(e), { id: t });
    }
  };

  useEffect(() => {
    let depth = 0; // dragenter/leave fire for every child; count them
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true); } };
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false); } };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // else the browser navigates to the file
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer!.files).filter((f) => f.type.startsWith("image/"));
      if (files.length) importImages(files);
      else toast.error("Hanya file gambar yang bisa dijatuhkan");
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  const preview = async (id: string) => {
    try {
      const doc = parseDoc(await (await fetch(`/api/projects/${encodeURIComponent(id)}`)).text());
      if (!doc.slides.length) return toast.error("Belum ada slide untuk di-preview");
      setPreviewing({ id, doc });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const exportTo = async (id: string, format: ExportOpts["format"]) => {
    const t = toast.loading(`Export ${format.toUpperCase()} "${id}"…`);
    try {
      await exportProject(id, { format, slide: format === "png" ? 0 : undefined, scale: 1 });
      toast.success("Export selesai", { id: t });
    } catch (e) {
      toast.error(`Export gagal: ${errMsg(e)}`, { id: t });
    }
  };

  const action = async (kind: Action, id: string) => {
    try {
      if (kind === "delete") {
        if (!(await confirm({
          title: `Hapus "${id}"?`,
          description: "Project dipindahkan ke projects/.trash dan bisa dipulihkan manual.",
          confirmText: "Hapus",
          destructive: true,
        }))) return;
        await api.remove(id);
      } else if (kind === "title") {
        const cur = projects.find((p) => p.id === id)?.title ?? "";
        const t = await ask({
          title: "Ubah judul",
          label: `Judul tampilan (kosongkan untuk memakai "${id}")`,
          initial: cur,
          confirmText: "Simpan",
          allowEmpty: true,
          validate: (v) => (v.length > 80 ? "Maks 80 karakter" : null),
        });
        if (t === null || t === cur) return;
        await api.setTitle(id, t);
      } else {
        const to = await ask({
          title: kind === "dup" ? `Salin "${id}"` : "Rename project",
          label: kind === "dup" ? "Nama salinan" : "Nama baru",
          initial: kind === "rename" ? id : undefined,
          confirmText: kind === "dup" ? "Salin" : "Rename",
          validate: validateProjectId,
        });
        if (!to || to === id) return;
        await (kind === "dup" ? api.create(to, id) : api.rename(id, to));
        if (kind === "rename" && pins.includes(id)) setPins((cur) => {
          const next = cur.map((x) => (x === id ? to : x));
          localStorage.setItem(PINS_KEY, JSON.stringify(next));
          return next;
        });
      }
      await onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const newTile = (
    <button
      type="button"
      onClick={() => setNewOpen(true)}
      className="text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-accent/40 flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors"
    >
      <span className="bg-muted grid size-10 place-items-center rounded-full"><Plus className="size-5" /></span>
      <span className="text-sm font-medium">Project baru</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Project">
        <ThemeToggle />
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 px-8 pt-10 pb-8">
          <section className="flex flex-col gap-6">
            <div>
              <p className="text-brand text-sm font-medium">{greeting()}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Mau bikin carousel apa hari ini?</h1>
              <p className="text-muted-foreground mt-1 text-sm">{summary(projects)}</p>
            </div>
            <AiCreate projects={projects} onChanged={onChanged} />
          </section>

          {hero && !filtering && <Hero p={hero} onOpen={onOpen} />}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold">Semua project</h2>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && first) onOpen(first.id);
                  else if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); }
                }}
                placeholder="Cari project…"
                className="h-9 w-56 pr-8 pl-8"
                aria-label="Cari project"
              />
              <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 text-[10px]">/</kbd>
            </div>
            <div className="bg-muted flex h-9 items-stretch rounded-md p-0.5 text-sm">
              {(["recent", "name"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortPersist(s)}
                  className={`rounded px-3 ${sort === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                >
                  {s === "recent" ? "Terbaru" : "Nama"}
                </button>
              ))}
            </div>
            <div className="bg-muted flex h-9 items-stretch rounded-md p-0.5" role="group" aria-label="Tampilan">
              {([["grid", LayoutGrid, "Grid"], ["list", List, "List"]] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewPersist(v)}
                  aria-label={label}
                  aria-pressed={view === v}
                  className={`grid w-9 place-items-center rounded ${view === v ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Project baru <kbd className="ml-1 rounded border border-current/30 px-1 text-[10px] opacity-70">N</kbd>
            </Button>
          </div>

          {projects.length > 0 && <FilterChips projects={projects} pins={pins} running={running} value={filter} onChange={setFilter} />}

          {projects.length === 0 ? (
            <div className="grid place-items-center gap-1 rounded-lg border border-dashed bg-muted/50 py-16 text-center">
              <NoProjectsArt className="mb-2 w-52" />
              <p className="text-lg font-semibold">Belum ada project</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Buat carousel pertamamu, atau jatuhkan gambar ke halaman ini untuk langsung jadi slide.
              </p>
              <Button onClick={() => setNewOpen(true)} className="mt-3 gap-1.5">
                <Plus className="size-4" /> Buat project pertama <kbd className="ml-1 rounded border border-current/30 px-1 text-[10px] opacity-70">N</kbd>
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <div className="grid place-items-center gap-1 py-12 text-center">
              <NoResultsArt className="mb-2 w-40" />
              <p className="font-medium">{needle ? `Tidak ada project cocok dengan "${q}"` : "Tidak ada project untuk filter ini"}</p>
              <p className="text-muted-foreground text-sm">{needle ? "Coba kata lain, atau cek ejaannya." : "Filter lain mungkin punya hasil."}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setQ(""); setFilter("all"); }}>
                {needle ? "Hapus pencarian" : "Reset filter"}
              </Button>
            </div>
          ) : (
            shown.map((g) => (
              <section key={g.key} className="flex flex-col gap-3">
                {g.label && (
                  <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                    {g.key === "pin" && <Star className="size-3.5 fill-amber-500 text-amber-500" />}
                    {g.label} <span className="font-normal tabular-nums">{g.total ?? g.items.length}</span>
                  </h2>
                )}
                {view === "grid" ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {!filtering && g.key === tileGroup && newTile}
                    {g.items.map((p) => (
                      <Card key={p.id} p={p} pinned={pins.includes(p.id)} selected={selected.has(p.id)} selecting={selected.size > 0} onSelect={select} onOpen={activate} onAction={action} onPin={togglePin} onPreview={preview} onExport={exportTo} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {g.items.map((p) => (
                      <Row key={p.id} p={p} pinned={pins.includes(p.id)} selected={selected.has(p.id)} selecting={selected.size > 0} onSelect={select} onOpen={activate} onAction={action} onPin={togglePin} onPreview={preview} onExport={exportTo} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}

          {hidden > 0 && (
            <div className="flex justify-center pb-4">
              <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
                Tampilkan {Math.min(PAGE, hidden)} lagi <span className="text-muted-foreground tabular-nums">({hidden} tersisa)</span>
              </Button>
            </div>
          )}
        </div>
        </div>
        <div className="no-scrollbar hidden w-80 shrink-0 overflow-y-auto px-4 pt-[148px] pb-8 xl:block">
          <HomeCards onPlan={onPlan} onBrands={onBrands} />
        </div>
      </div>

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          total={order.length}
          allPinned={[...selected].every((id) => pins.includes(id))}
          busy={bulkBusy}
          onPin={bulkPin}
          onExport={bulkExport}
          onDelete={bulkDelete}
          onAll={() => setSelected(new Set(order.length ? order : projects.map((p) => p.id)))}
          onClear={() => setSelected(new Set())}
        />
      )}
      <NewProjectDialog open={newOpen} projects={projects} onClose={() => setNewOpen(false)} onCreate={create} />
      {previewing && <Preview doc={previewing.doc} project={previewing.id} start={0} onClose={() => setPreviewing(null)} />}

      {dragging && (
        <div className="bg-background/80 pointer-events-none fixed inset-0 z-50 grid place-items-center backdrop-blur-sm">
          <div className="border-brand flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-16 py-12">
            <Upload className="text-brand size-8" />
            <p className="font-medium">Lepas gambar untuk membuat project baru</p>
            <p className="text-muted-foreground text-sm">Satu slide per gambar</p>
          </div>
        </div>
      )}
    </div>
  );
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

