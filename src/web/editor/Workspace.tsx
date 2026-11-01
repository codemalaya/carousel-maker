import { useEffect, useRef, useState } from "react";
import { Element } from "../../core/schema";
import { WorkspaceSkeleton } from "@/app/WorkspaceSkeleton";
import { useEditor, parseDoc } from "@/editor/useEditor";
import { Canvas } from "@/editor/canvas/Canvas";
import { Inspector } from "@/editor/inspector/Inspector";
import { SlidePanel } from "@/editor/panel/SlidePanel";
import { toast } from "sonner";
import { useDialogs, validateProjectId } from "@/app/dialogs";
import { ExportBar } from "@/editor/inspector/ExportBar";
import { CaptionDialog } from "@/editor/inspector/CaptionDialog";
import { Header } from "@/app/Header";
import { Preview } from "@/editor/present/Preview";
import { Present } from "@/editor/present/Present";
import { AUTO_PUBLISH_KEY } from "@/pages/planner/planUtils";
import { Toolbar } from "@/editor/Toolbar";
import { AssetLibrary } from "@/editor/AssetLibrary";
import { AgentBar, type EditorContext } from "@/editor/ai/AgentBar";
import { slideTitle } from "@/shared/slideTitle";
import { setViewing, useRunning, useRuns } from "@/editor/ai/agentRuns";
import { Resizer } from "@/editor/panel/Resizer";
import { usePanelWidth } from "@/editor/panel/usePanelWidth";
import { api, exportProject, uploadAsset, type ExportOpts, type ProjectInfo } from "@/shared/api";
import { useEditorKeys } from "@/editor/useEditorKeys";

const NEW: Record<string, () => unknown> = {
  text: () => ({ type: "text", text: "Teks baru", x: 100, y: 100, w: 700, style: { fontSize: 80, color: "#111", fontWeight: 700 } }),
  shape: () => ({ type: "shape", kind: "rect", x: 120, y: 120, w: 360, h: 360, fill: "#ff4d2e" }),
  chart: () => ({ type: "chart", kind: "bar", x: 80, y: 120, w: 880, h: 560, title: "Judul grafik", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "2025", values: [12, 19, 8, 24] }], style: { fontSize: 26, color: "#111" } }),
  table: () => ({ type: "table", x: 80, y: 120, w: 880, rows: [["Paket", "Harga", "Fitur"], ["Basic", "Rp 99rb", "3 slide"], ["Pro", "Rp 199rb", "10 slide"]], style: { fontSize: 28, color: "#111" } }),
  html: () => ({ type: "html", x: 100, y: 100, w: 600, h: 240, html: "<div style='padding:24px;font:48px sans-serif'>HTML / SVG</div>" }),
};

export type Preloaded = { id: string; text: string; doc: ReturnType<typeof parseDoc> };

export function Workspace({ project, preloaded, projects, onSwitch, onHome, onProjectsChanged }: {
  project: string;
  preloaded?: Preloaded;
  projects: ProjectInfo[];
  onSwitch: (id: string) => void;
  onHome: () => void;
  onProjectsChanged: () => Promise<ProjectInfo[]>;
}) {
  const ed = useEditor(project, preloaded?.id === project ? preloaded : undefined);
  const [leftW, setLeftW] = usePanelWidth("carousel-left-w", 280, 160, 520);
  const [rightW, setRightW] = usePanelWidth("carousel-right-w", 300, 240, 480);
  const { ask, confirm } = useDialogs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [present, setPresent] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const aiBusy = useRuns(project)[0]?.status === "running";
  // a run that was started elsewhere (planner "Buat carousel") is already going when the editor opens: show it
  useEffect(() => {
    if (aiBusy) setAiOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);
  const running = useRunning();
  const elsewhere = [...running].filter((id) => id !== project);
  useEffect(() => {
    setViewing(project);
    return () => setViewing(null);
  }, [project]);
  const [exporting, setExporting] = useState<ExportOpts["format"] | null>(null);
  const [scale, setScale] = useState(1);
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const doc = ed.doc;

  const nSlides = doc?.slides.length ?? 0;
  const nEls = doc?.slides[cur]?.elements.length ?? 0;
  useEffect(() => {
    if (cur > 0 && cur >= nSlides) setCur(Math.max(0, nSlides - 1));
    if (sel != null && sel >= nEls) setSel(null);
  }, [nSlides, nEls, cur, sel]);

  // keyboard: undo/redo, delete, nudge, duplicate
  useEditorKeys({ ed, sel, cur, nSlides, setSel, setPreview, setPresent });

  const selEl = sel != null ? doc?.slides[cur]?.elements[sel] : undefined;
  const aiCtx: EditorContext = {
    cur,
    count: nSlides,
    title: doc?.slides[cur] ? slideTitle(doc.slides[cur], cur).title : "",
    sel: selEl && sel != null ? { index: sel, type: selEl.type, text: selEl.type === "text" ? selEl.text : undefined } : null,
  };

  if (ed.error && !doc) return <pre style={{ padding: 16 }}>{ed.error}</pre>;
  if (!doc) return <WorkspaceSkeleton leftW={leftW} rightW={rightW} />;

  const addImageFile = async (file: File) => {
    if (!doc?.slides.length || !file.type.startsWith("image/")) return;
    try {
      const { name, w, h } = await uploadAsset(project, file);
      const width = Math.min(760, w);
      const at = doc.slides[cur].elements.length;
      ed.mutate((d) => {
        d.slides[cur].elements.push(
          Element.parse({ type: "image", src: `assets/${name}`, x: 100, y: 100, w: width, h: Math.round((width * h) / w), fit: "contain" }),
        );
      });
      setSel(at);
    } catch (e) {
      toast.error(`Upload gagal: ${errMsg(e)}`);
    }
  };

  const projectAction = async (kind: "new" | "dup" | "rename" | "delete") => {
    try {
      if (kind === "new" || kind === "dup") {
        const id = await ask({
          title: kind === "new" ? "Project baru" : `Salin "${project}"`,
          label: kind === "new" ? "Nama project" : "Nama salinan",
          confirmText: kind === "new" ? "Buat" : "Salin",
          validate: validateProjectId,
        });
        if (!id) return;
        await api.create(id, kind === "dup" ? project : undefined);
        await onProjectsChanged();
        onSwitch(id);
      } else if (kind === "rename") {
        const id = await ask({
          title: "Rename project",
          label: "Nama baru",
          initial: project,
          confirmText: "Rename",
          validate: validateProjectId,
        });
        if (!id || id === project) return;
        await api.rename(project, id);
        await onProjectsChanged();
        onSwitch(id);
      } else if (
        await confirm({
          title: `Hapus "${project}"?`,
          description: "Project dipindahkan ke projects/.trash dan bisa dipulihkan manual.",
          confirmText: "Hapus",
          destructive: true,
        })
      ) {
        await api.remove(project);
        await onProjectsChanged();
        onHome();
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const goHome = async () => {
    await ed.flush(); // debounced save would be lost on unmount
    onHome();
  };

  const doExport = async (o: ExportOpts) => {
    setExporting(o.format);
    const video = o.format === "mp4" || o.format === "gif";
    const t = video ? toast.loading(`Merender ${o.format.toUpperCase()}… bisa beberapa menit`) : undefined;
    try {
      await ed.flush();
      await exportProject(project, { ...o, scale });
      toast.success("Export selesai", { id: t });
      if (localStorage.getItem(AUTO_PUBLISH_KEY) !== "0") {
        api.planExported(project).then((r) => r.marked && toast.success(`${r.marked} rencana konten ditandai terbit`), () => {});
      }
    } catch (e) {
      toast.error(`Export gagal: ${errMsg(e)}`, { id: t });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="app workspace-in relative" style={{ gridTemplateColumns: `${leftW}px 1fr ${rightW}px` }}>
      <Header
        status={ed.status}
        error={ed.error}
        project={project}
        title={doc.title}
        onHome={goHome}
        aiElsewhere={elsewhere}
        onOpenProject={onSwitch}
        slide={doc.slides[cur] ? cur + 1 : 0}
        count={nSlides}
        slideName={doc.slides[cur]?.name?.trim() || undefined}
        format={doc.format}
        onFormat={(f) => ed.mutate((d) => { d.format = f; })}
        canPreview={nSlides > 0}
        onPreview={() => setPreview(true)}
        onPresent={() => setPresent(true)}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) addImageFile(f);
        }}
      />

      <SlidePanel
        ed={ed}
        project={project}
        projects={projects}
        onSwitch={onSwitch}
        onProjectAction={projectAction}
        onHome={goHome}
        cur={cur}
        setCur={setCur}
        setSel={setSel}
      />

      <main
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          Array.from(e.dataTransfer.files).forEach(addImageFile);
        }}
      >
        {doc.slides[cur] ? (
          <Canvas ed={ed} project={project} cur={cur} sel={sel} setSel={setSel} />
        ) : (
          <p style={{ margin: "auto", opacity: 0.6 }}>Belum ada slide. Klik "+ Slide" di panel kiri.</p>
        )}
        <AssetLibrary open={assetsOpen} onOpenChange={setAssetsOpen} ed={ed} project={project} cur={cur} onInserted={setSel} />
        <AgentBar project={project} flush={ed.flush} open={aiOpen} onOpenChange={setAiOpen} ctx={aiCtx} />
        <Toolbar
          canUndo={ed.canUndo}
          canRedo={ed.canRedo}
          onUndo={ed.undo}
          onRedo={ed.redo}
          hasSlide={!!doc.slides[cur]}
          onAddElement={(t) => {
            ed.mutate((d) => { d.slides[cur].elements.push(Element.parse(NEW[t]())); });
            setSel(nEls);
          }}
          onPickImage={() => fileInput.current?.click()}
          onOpenAssets={() => setAssetsOpen(true)}
          aiOpen={aiOpen}
          aiBusy={aiBusy}
          onToggleAi={() => setAiOpen((o) => !o)}
        />
      </main>

      <Inspector ed={ed} project={project} cur={cur} sel={sel} setSel={setSel} footer={
          <ExportBar
            hasSlide={!!doc.slides[cur]}
            exporting={exporting}
            scale={scale}
            onScale={setScale}
            onExport={(o) => doExport({ ...o, slide: o.format === "png" ? cur : undefined })}
            onCaption={async () => {
              await ed.flush(); // the agent reads the file on disk
              setCaptionOpen(true);
            }}
          />
        }
      />
      <CaptionDialog open={captionOpen} onOpenChange={setCaptionOpen} project={project} />
      <Resizer side="left" offset={leftW} onResize={setLeftW} />
      <Resizer side="right" offset={rightW} onResize={setRightW} />
      {present && (
        <Present
          doc={doc}
          project={project}
          start={cur}
          onClose={(i) => {
            setPresent(false);
            setCur(i);
            setSel(null);
          }}
        />
      )}
      {preview && (
        <Preview
          doc={doc}
          project={project}
          start={cur}
          onClose={(i) => {
            setPreview(false);
            setCur(i);
            setSel(null);
          }}
        />
      )}
    </div>
  );
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
