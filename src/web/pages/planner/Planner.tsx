import { useMemo, useState } from "react";
import { Bell, CalendarPlus, Check, ChevronLeft, ChevronRight, Download, GripVertical, Lightbulb, Plus, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PLAN_STATUS, type PlanItem } from "../../../core/schema";
import { api, type ProjectInfo } from "@/shared/api";
import { STATUS_DOT, STATUS_LABEL } from "@/pages/planner/planMeta";
import { isLate, usePlan, usePlanAlerts } from "@/pages/planner/planStore";
import { askNotifications, canNotify, notifyPermission } from "@/pages/planner/reminders";
import { PageHeader } from "@/shared/PageHeader";
import { PlanAgentDialog } from "@/pages/planner/PlanAgent";
import { AllScheduledArt } from "@/shared/PlanBrandArt";
import { ThemeToggle } from "@/app/ThemeToggle";
import { errMsg, DAYS, MONTHS, STATUS_HINT, AUTO_PUBLISH_KEY, iso, parse, addDays, weekStart, DRAG_ITEM, DRAG_PROJECT, MAX_CHIPS } from "@/pages/planner/planUtils";
import { Chip } from "@/pages/planner/PlanChip";
import { ItemDialog } from "@/pages/planner/ItemDialog";


/** Content calendar (`?plan=1`): month / week grid of slots. Drag a slot to another day, or drag a project from the side list onto a day. Local only: nothing is posted. */
export function Planner({ projects, onOpen }: { projects: ProjectInfo[]; onOpen: (id: string) => void }) {
  const { items, set: setItems, refresh } = usePlan();
  const [view, setView] = useState<"bulan" | "minggu">("bulan");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dialog, setDialog] = useState<(Omit<PlanItem, "id"> & { id?: string }) | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [perm, setPerm] = useState(notifyPermission);
  const alerts = usePlanAlerts();
  const [auto, setAuto] = useState(() => localStorage.getItem(AUTO_PUBLISH_KEY) !== "0");

  const today = iso(new Date());
  const days = useMemo(() => {
    const start = view === "minggu" ? weekStart(anchor) : weekStart(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const count = view === "minggu" ? 7 : Math.ceil(((new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7 + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  const byDay = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    for (const i of items ?? []) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);
  const linkedIds = new Set((items ?? []).map((i) => i.project).filter(Boolean));
  const unplanned = projects.filter((p) => !linkedIds.has(p.id));
  const known = new Set(projects.map((p) => p.id));

  const step = (n: number) => setAnchor((a) => (view === "minggu" ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)));
  const heading = view === "minggu"
    ? { main: `${days[0].getDate()} ${MONTHS[days[0].getMonth()].slice(0, 3)} – ${days[6].getDate()} ${MONTHS[days[6].getMonth()].slice(0, 3)}`, sub: String(days[6].getFullYear()) }
    : { main: MONTHS[anchor.getMonth()], sub: String(anchor.getFullYear()) };
  const openWeek = (d: Date) => { setAnchor(d); setView("minggu"); };
  const jumpToOverdue = () => {
    const first = (items ?? []).filter((i) => isLate(i, today)).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!first) return;
    setAnchor(parse(first.date));
    setView("bulan");
    window.setTimeout(() => document.querySelector(`[data-date="${first.date}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
  };
  const enableNotifications = async () => setPerm(await askNotifications());

  const blank = (date: string): Omit<PlanItem, "id"> => ({ title: "", date, time: "09:00", platform: "instagram", caption: "", hashtags: "", status: "ide" });

  const drop = async (date: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData(DRAG_ITEM);
    const project = e.dataTransfer.getData(DRAG_PROJECT);
    try {
      if (id) {
        const cur = items?.find((i) => i.id === id);
        if (!cur || cur.date === date) return;
        setItems((l) => l && l.map((i) => (i.id === id ? { ...i, date } : i))); // optimistic
        await api.updatePlan(id, { date });
        await refresh();
      } else if (project) {
        const p = projects.find((x) => x.id === project);
        await api.createPlan({ ...blank(date), title: p?.title || project, project, format: p?.format, status: "draft" });
        await refresh();
      }
    } catch (err) {
      toast.error(errMsg(err));
      await refresh();
    }
  };

  const toggleAuto = (on: boolean) => {
    setAuto(on);
    localStorage.setItem(AUTO_PUBLISH_KEY, on ? "1" : "0");
  };

  const longToday = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const panel = "bg-card rounded-2xl border p-4";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Rencana konten">
        <ThemeToggle />
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-8 pt-10 pb-8">
            <section>
              <p className="text-brand text-sm font-medium">{longToday}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Kapan carousel kamu tayang?</h1>
              <p className="text-muted-foreground mt-1 text-sm">Atur jadwal, caption, dan status tiap konten dalam satu kalender.</p>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="min-w-44 text-xl font-semibold">
                {heading.main} <span className="text-muted-foreground font-normal">{heading.sub}</span>
              </h2>
              <div className="flex items-center rounded-lg border">
                <Button variant="ghost" size="icon" className="size-8 rounded-r-none" aria-label="Sebelumnya" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 rounded-none border-x px-3" onClick={() => setAnchor(new Date())}>Hari ini</Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-l-none" aria-label="Berikutnya" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
              </div>
              {alerts.overdue > 0 && (
                <button type="button" onClick={jumpToOverdue} className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400" title="Lihat slot yang terlewat">
                  {alerts.overdue} terlewat
                </button>
              )}
              {alerts.today > 0 && <span className="bg-brand/10 text-brand rounded-full px-2.5 py-1 text-xs font-medium">{alerts.today} hari ini</span>}
              <div className="ml-auto flex items-center gap-2">
                <div role="radiogroup" aria-label="Tampilan" className="bg-muted flex h-9 items-stretch rounded-md p-0.5 text-sm">
                  {(["bulan", "minggu"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn("rounded px-3 capitalize", view === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>{v}</button>
                  ))}
                </div>
                <Button variant="outline" className="h-9 gap-1.5" onClick={() => setAi(true)}><Sparkles className="size-4" /> Ide AI</Button>
                <Button className="h-9 gap-1.5" onClick={() => setDialog(blank(today))}><Plus className="size-4" /> Rencana baru</Button>
              </div>
            </div>

            <div className="bg-card overflow-hidden rounded-xl border">
              <div className="grid grid-cols-7 border-b">
                {DAYS.map((d, n) => (
                  <div key={d} className={cn("py-2.5 text-center text-[11px] font-medium tracking-wider uppercase", n >= 5 ? "text-muted-foreground/70" : "text-muted-foreground")}>{d}</div>
                ))}
              </div>
              {items === null ? (
                <Skeleton className="m-3 h-96" />
              ) : (
                <div className="grid grid-cols-7" style={{ gridAutoRows: view === "minggu" ? "minmax(16rem, auto)" : "minmax(9rem, auto)" }}>
                  {days.map((d, n) => {
                    const key = iso(d);
                    const list = byDay.get(key) ?? [];
                    const shown = view === "bulan" ? list.slice(0, MAX_CHIPS) : list;
                    const more = list.length - shown.length;
                    const outside = view === "bulan" && d.getMonth() !== anchor.getMonth();
                    const isToday = key === today;
                    return (
                      <div
                        key={key}
                        data-date={key}
                        onClick={() => setDialog(blank(key))}
                        onDragOver={(e) => { e.preventDefault(); setOver(key); }}
                        onDragLeave={() => setOver((o) => (o === key ? null : o))}
                        onDrop={(e) => drop(key, e)}
                        className={cn(
                          "group flex min-w-0 cursor-pointer flex-col gap-1 border-r border-b p-2 transition-colors [&:nth-child(7n)]:border-r-0",
                          n % 7 >= 5 && "bg-muted/25",
                          outside && "bg-muted/40",
                          isToday && "bg-brand/5",
                          over === key ? "bg-accent ring-brand/60 ring-2 ring-inset" : "hover:bg-accent/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-medium tabular-nums", isToday ? "bg-brand text-white" : outside ? "text-muted-foreground/50" : key < today ? "text-muted-foreground" : "text-foreground")}>{d.getDate()}</span>
                          <Plus className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                        </div>
                        {shown.map((i) => <Chip key={i.id} item={i} late={isLate(i, today)} compact={view === "bulan"} projectMissing={!!i.project && !known.has(i.project)} onOpen={() => setDialog(i)} />)}
                        {more > 0 && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); openWeek(d); }} className="text-muted-foreground hover:text-foreground w-full rounded px-1.5 py-0.5 text-left text-[11px]">
                            +{more} lagi
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="no-scrollbar hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto px-4 pt-[148px] pb-8 xl:flex [&>*]:shrink-0">
          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><CalendarPlus className="text-muted-foreground size-4" /> Belum dijadwalkan</h3>
            <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">Tarik project ke tanggal di kalender.</p>
            <div className="flex flex-col gap-1.5">
              {unplanned.length === 0 && (
                <div className="bg-muted/50 grid place-items-center gap-1 rounded-lg px-3 py-5 text-center">
                  <AllScheduledArt className="w-32" />
                  <p className="text-sm font-medium">{projects.length ? "Semua sudah terjadwal" : "Belum ada project"}</p>
                  <p className="text-muted-foreground max-w-48 text-xs">{projects.length ? "Setiap project sudah punya slot di kalender." : "Buat project di Home, lalu jadwalkan di sini."}</p>
                </div>
              )}
              {unplanned.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData(DRAG_PROJECT, p.id); e.dataTransfer.effectAllowed = "copy"; }}
                  className="hover:bg-accent/60 flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors active:cursor-grabbing"
                  title={`${p.title || p.id} · ${p.format} · ${p.slides} slide`}
                >
                  <GripVertical className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{p.title || p.id}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">{p.format}</span>
                </div>
              ))}
              {unplanned.length > 6 && <p className="text-muted-foreground px-1 text-[11px]">+{unplanned.length - 6} project lain</p>}
            </div>
          </section>

          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><Tag className="text-muted-foreground size-4" /> Arti status</h3>
            <ul className="mt-3 flex flex-col gap-2 text-xs">
              {PLAN_STATUS.map((st) => (
                <li key={st} className="flex items-start gap-2.5">
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", STATUS_DOT[st])} aria-hidden />
                  <span><span className="font-medium">{STATUS_LABEL[st]}</span> <span className="text-muted-foreground">· {STATUS_HINT[st]}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <section className={panel}>
            <h3 className="flex items-center gap-2 text-sm font-medium"><Bell className="text-muted-foreground size-4" /> Pengingat</h3>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">Slot berstatus Siap atau Terjadwal mengingatkan kamu di jam tayang, selama tab editor ini terbuka. Tidak ada yang diposting otomatis.</p>
            {canNotify() && (
              perm === "granted" ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"><Check className="size-3.5" /> Notifikasi browser aktif</p>
              ) : perm === "denied" ? (
                <p className="text-muted-foreground mt-3 text-xs">Notifikasi diblokir di browser. Pengingat tetap muncul di dalam aplikasi.</p>
              ) : (
                <Button variant="outline" size="sm" className="mt-3 h-8 gap-1.5" onClick={enableNotifications}><Bell className="size-3.5" /> Aktifkan notifikasi</Button>
              )
            )}
            <a href="/api/plan/ics" download className="text-brand mt-3 flex w-fit items-center gap-1.5 text-xs font-medium hover:underline"><Download className="size-3.5" /> Unduh .ics untuk kalender lain</a>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 p-5 text-white">
            <span className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-white/10" aria-hidden />
            <span className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-black/10" aria-hidden />
            <h3 className="relative flex items-center gap-2 text-base font-semibold"><Lightbulb className="size-4" /> Tips</h3>
            <ul className="relative mt-3 flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-white/90 marker:text-white/60">
              <li>Klik hari untuk menambah rencana, tarik slot untuk memindahkannya.</li>
              <li>Slot tanpa project adalah ide. Minta AI mengisinya lewat "Ide AI", lalu ubah jadi project dengan "Buat carousel".</li>
              <li>Tidak ada yang diposting otomatis. Data tersimpan di data/planner.json.</li>
            </ul>
            <label className="relative mt-4 flex items-start gap-2 border-t border-white/25 pt-3 text-xs" title="Saat project diekspor, slot berstatus Siap/Terjadwal yang tertaut jadi Terbit">
              <input type="checkbox" className="mt-0.5 accent-white" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} />
              <span>Tandai terbit saat project diekspor</span>
            </label>
          </section>
        </div>
      </div>

      {ai && <PlanAgentDialog onClose={() => setAi(false)} onProgress={refresh} />}
      {dialog && (
        <ItemDialog
          key={dialog.id ?? "new"}
          item={dialog}
          projects={projects}
          onClose={() => setDialog(null)}
          onSaved={refresh}
          onRemoved={refresh}
          onOpenProject={onOpen}
        />
      )}
    </div>
  );
}

