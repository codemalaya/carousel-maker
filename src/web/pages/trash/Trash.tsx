import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Info, Lightbulb, Palette, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMATS } from "../../../core/schema";
import { cn } from "@/lib/utils";
import { api, type BrandTrashItem, type PlanTrashItem, type TemplateTrashItem, type ProjectInfo, type TrashItem } from "@/shared/api";
import { Swatches } from "@/pages/brands/Brands";
import { PLATFORM_LABEL, STATUS_DOT, STATUS_LABEL } from "@/pages/planner/planMeta";
import { useDialogs } from "@/app/dialogs";
import { EmptyTrashArt } from "@/pages/trash/EmptyTrashArt";
import { ago } from "@/shared/format";
import { PageHeader } from "@/shared/PageHeader";
import { SlideView } from "@/shared/SlideView";
import { ThemeToggle } from "@/app/ThemeToggle";
import { useLazyDoc } from "@/shared/useLazyDoc";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Slide 1 of a trashed project; its spec and assets are served from the trash folder. */
function TrashThumb({ it }: { it: TrashItem }) {
  const key = encodeURIComponent(it.name);
  const { box, doc, width } = useLazyDoc(`/api/trash/${key}/spec`, 0);
  const fmt = FORMATS[it.format];
  return (
    <div ref={box} className="bg-canvas w-full overflow-hidden opacity-80 grayscale-[0.4]" style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}>
      {doc && doc.slides.length > 0 && width > 0 ? (
        <SlideView doc={doc} project={it.id} index={0} scale={width / fmt.width} assetBase={`/api/trash/${key}/assets`} />
      ) : doc ? (
        <div className="text-muted-foreground grid h-full place-items-center text-xs">Belum ada slide</div>
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </div>
  );
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One mixed list: projects, brand kits and plan slots, newest deletion first. `key` is unique across kinds. */
type Row =
  | { kind: "project"; key: string; deleted: number; it: TrashItem }
  | { kind: "brand"; key: string; deleted: number; it: BrandTrashItem }
  | { kind: "plan"; key: string; deleted: number; it: PlanTrashItem }
  | { kind: "template"; key: string; deleted: number; it: TemplateTrashItem };

const KIND_LABEL = { project: "Project", brand: "Brand kit", plan: "Rencana", template: "Template" } as const;
const KIND_DEL = { project: "project", brand: "brand kit", plan: "slot rencana", template: "template" } as const;

function KindBadge({ kind }: { kind: Row["kind"] }) {
  return <span className="bg-background/90 text-foreground/80 absolute top-2 left-2 z-10 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm">{KIND_LABEL[kind]}</span>;
}

/** Template thumbnail: the one-slide spec and images are served from the trash folder. */
function TemplateThumb({ it }: { it: TemplateTrashItem }) {
  const key = encodeURIComponent(it.name);
  const { box, doc, width } = useLazyDoc(`/api/trash/template/${key}/spec`, 0);
  const fmt = FORMATS[it.format];
  return (
    <div className="relative">
      <KindBadge kind="template" />
      <div ref={box} className="bg-canvas w-full overflow-hidden opacity-80 grayscale-[0.4]" style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}>
        {doc && width > 0 ? <SlideView doc={doc} project={it.id} index={0} scale={width / fmt.width} assetBase={`/api/trash/template/${key}/assets`} /> : <Skeleton className="size-full rounded-none" />}
      </div>
    </div>
  );
}

function BrandThumb({ it }: { it: BrandTrashItem }) {
  return (
    <div className="bg-muted/60 relative grid h-32 place-items-center opacity-80 grayscale-[0.3]">
      <KindBadge kind="brand" />
      <div className="flex flex-col items-center gap-3">
        <span className="bg-card grid size-12 place-items-center rounded-xl border text-lg font-semibold">{(it.title || it.id).charAt(0).toUpperCase()}</span>
        {it.colors.length > 0 ? <Swatches colors={it.colors} /> : <Palette className="text-muted-foreground size-4" />}
      </div>
    </div>
  );
}

function PlanThumb({ it }: { it: PlanTrashItem }) {
  const d = new Date(`${it.date}T00:00:00`);
  return (
    <div className="bg-muted/60 relative grid h-32 place-items-center opacity-80 grayscale-[0.3]">
      <KindBadge kind="plan" />
      <div className="flex items-center gap-3">
        <span className="bg-card grid w-12 place-items-center rounded-xl border py-1.5 leading-none">
          <span className="text-lg font-semibold tabular-nums">{d.getDate()}</span>
          <span className="text-muted-foreground mt-0.5 text-[10px] uppercase">{d.toLocaleDateString("id-ID", { month: "short" })}</span>
        </span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          {it.time}<br />{PLATFORM_LABEL[it.platform]}<br />
          <span className="inline-flex items-center gap-1"><span className={cn("size-1.5 rounded-full", STATUS_DOT[it.status])} />{STATUS_LABEL[it.status]}</span>
        </span>
      </div>
    </div>
  );
}

/** Deleted projects, brand kits and plan slots. Restore never overwrites; permanent delete always asks first. */
export function Trash({ onChanged }: { onChanged: () => Promise<ProjectInfo[]> }) {
  const { confirm } = useDialogs();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [projects, brands, plan, templates] = await Promise.all([api.trash(), api.trashBrands(), api.trashPlan(), api.trashTemplates()]);
      const all: Row[] = [
        ...projects.map((it): Row => ({ kind: "project", key: `p:${it.name}`, deleted: it.deleted, it })),
        ...brands.map((it): Row => ({ kind: "brand", key: `b:${it.name}`, deleted: it.deleted, it })),
        ...plan.map((it): Row => ({ kind: "plan", key: `r:${it.id}`, deleted: it.deleted, it })),
        ...templates.map((it): Row => ({ kind: "template", key: `t:${it.name}`, deleted: it.deleted, it })),
      ];
      setRows(all.sort((a, b) => b.deleted - a.deleted));
    } catch (e) {
      toast.error(errMsg(e));
      setRows((cur) => cur ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const titleOf = (r: Row) => (r.kind === "plan" ? r.it.title || r.it.project || "Tanpa judul" : r.it.title || r.it.id);

  const restore = (r: Row) =>
    run(r.key, async () => {
      if (r.kind === "project") {
        const { id } = await api.restore(r.it.name);
        await onChanged();
        toast.success(id === r.it.id ? `"${id}" dipulihkan` : `Dipulihkan sebagai "${id}" ("${r.it.id}" sudah dipakai)`);
      } else if (r.kind === "template") {
        const { id } = await api.restoreTemplate(r.it.name);
        toast.success(id === r.it.id ? `Template "${id}" dipulihkan` : `Template dipulihkan sebagai "${id}" ("${r.it.id}" sudah dipakai)`);
      } else if (r.kind === "brand") {
        const { id } = await api.restoreBrand(r.it.name);
        toast.success(id === r.it.id ? `Brand "${id}" dipulihkan` : `Brand dipulihkan sebagai "${id}" ("${r.it.id}" sudah dipakai)`);
      } else {
        await api.restorePlan(r.it.id);
        toast.success(`Rencana "${titleOf(r)}" dipulihkan`);
      }
    });

  const purge = async (r: Row) => {
    const description = r.kind === "project"
      ? `${r.it.slides} slide beserta asset dan referensinya akan hilang dari disk. Tidak bisa dibatalkan.`
      : r.kind === "template"
        ? "Slide template ini beserta gambarnya akan hilang dari disk. Project yang sudah memakainya tidak berubah. Tidak bisa dibatalkan."
      : r.kind === "brand"
        ? "Palette, font, logo, dan arahan gaya brand ini akan hilang dari disk. Project yang sudah memakainya tidak berubah. Tidak bisa dibatalkan."
        : "Slot rencana ini dihapus permanen. Project yang tertaut tidak ikut terhapus. Tidak bisa dibatalkan.";
    if (!(await confirm({ title: `Hapus permanen ${KIND_DEL[r.kind]} "${titleOf(r)}"?`, description, confirmText: "Hapus permanen", destructive: true }))) return;
    await run(r.key, async () => {
      if (r.kind === "project") await api.purge(r.it.name);
      else if (r.kind === "template") await api.purgeTemplate(r.it.name);
      else if (r.kind === "brand") await api.purgeBrand(r.it.name);
      else await api.purgePlan(r.it.id);
      toast.success(`"${titleOf(r)}" dihapus permanen`);
    });
  };

  const empty = async () => {
    if (!rows?.length) return;
    const n = (k: Row["kind"]) => rows.filter((r) => r.kind === k).length;
    const parts = (["project", "brand", "plan", "template"] as const).filter(n).map((k) => `${n(k)} ${KIND_DEL[k]}`);
    if (!(await confirm({
      title: `Kosongkan sampah (${rows.length} item)?`,
      description: `${parts.join(", ")} dihapus permanen dari disk. Tidak bisa dibatalkan.`,
      confirmText: "Kosongkan",
      destructive: true,
    }))) return;
    await run("*", async () => {
      const [a, b, c, d] = await Promise.all([api.emptyTrash(), api.emptyBrandTrash(), api.emptyPlanTrash(), api.emptyTemplateTrash()]);
      toast.success(`${a.removed + b.removed + c.removed + d.removed} item dihapus permanen`);
    });
  };

  const panel = "bg-card rounded-2xl border p-4";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Sampah">
        <ThemeToggle />
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-8 pt-10 pb-8">
            <section>
              <p className="text-brand text-sm font-medium">Bisa dipulihkan kapan saja</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Yang kamu hapus</h1>
              <p className="text-muted-foreground mt-1 text-sm">Project, brand kit, template, dan rencana konten yang dihapus disimpan di sini. Pulihkan, atau hapus permanen.</p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Isi sampah</h2>
              <Button variant="outline" size="sm" className="text-destructive h-9 gap-1.5" disabled={!rows?.length || busy !== null} onClick={empty}>
                <Trash2 className="size-4" /> Kosongkan sampah
              </Button>
            </div>

            {rows === null ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />)}
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-muted/50 grid place-items-center gap-1 rounded-lg border border-dashed py-16 text-center">
                <EmptyTrashArt className="mb-2 w-48" />
                <p className="text-lg font-semibold">Sampah kosong</p>
                <p className="text-muted-foreground max-w-xs text-sm">Project, brand kit, template, dan rencana yang kamu hapus akan muncul di sini, dan bisa dipulihkan kapan saja.</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-start gap-4">
                {rows.map((r) => (
                  <div key={r.key} className="bg-card flex flex-col overflow-hidden rounded-lg border">
                    {r.kind === "project" ? (
                      <div className="relative"><KindBadge kind="project" /><TrashThumb it={r.it} /></div>
                    ) : r.kind === "template" ? (
                      <TemplateThumb it={r.it} />
                    ) : r.kind === "brand" ? (
                      <BrandThumb it={r.it} />
                    ) : (
                      <PlanThumb it={r.it} />
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={titleOf(r)}>{titleOf(r)}</div>
                        <div className="text-muted-foreground text-xs" title={r.deleted ? when(r.deleted) : undefined}>
                          {r.kind === "project" ? `${r.it.slides} slide · ` : ""}{r.deleted ? `dihapus ${ago(r.deleted)}` : "dihapus sebelumnya"}
                        </div>
                      </div>
                      <div className="mt-auto flex gap-1.5">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={busy !== null} onClick={() => restore(r)}>
                          <RotateCcw className="size-3.5" /> Pulihkan
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive size-8"
                          disabled={busy !== null}
                          onClick={() => purge(r)}
                          aria-label={`Hapus permanen ${titleOf(r)}`}
                          title="Hapus permanen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="no-scrollbar hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto px-4 pt-[148px] pb-8 xl:flex [&>*]:shrink-0">
          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><Info className="text-muted-foreground size-4" /> Cara kerja</h3>
            <ul className="text-muted-foreground mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed">
              <li>Menghapus project, brand kit, template, atau slot rencana hanya memindahkannya ke sampah.</li>
              <li>Memulihkan tidak pernah menimpa yang sudah ada. Namanya diberi akhiran -restored.</li>
              <li>Hapus permanen hanya bisa dari halaman ini, dan selalu meminta konfirmasi.</li>
            </ul>
          </section>

          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="text-muted-foreground size-4" /> Tersimpan di mana</h3>
            <ul className="text-muted-foreground mt-3 flex flex-col gap-1.5 text-xs leading-relaxed">
              <li><span className="text-foreground font-medium">Project</span> · <code>projects/.trash</code></li>
              <li><span className="text-foreground font-medium">Brand kit</span> · <code>brands/.trash</code></li>
              <li><span className="text-foreground font-medium">Template</span> · <code>templates/.trash</code></li>
              <li><span className="text-foreground font-medium">Rencana</span> · <code>planner.trash.json</code></li>
            </ul>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-700 p-5 text-white">
            <span className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-white/10" aria-hidden />
            <span className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" aria-hidden />
            <h3 className="relative flex items-center gap-2 text-base font-semibold"><Lightbulb className="size-4" /> Tips</h3>
            <ul className="relative mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-white/90 marker:text-white/60">
              <li>Salah hapus? Klik Pulihkan, semuanya kembali seperti semula.</li>
              <li>Brand yang dipulihkan tidak mengubah project yang sudah memakainya.</li>
              <li>AI dan CLI tidak pernah menghapus permanen. Hanya kamu yang bisa.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
