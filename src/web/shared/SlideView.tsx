import { useMemo, type ReactNode } from "react";
import { FORMATS, type Carousel } from "../../core/schema";
import { ANIM_CSS, maxStep, renderSlideBody, stepCss } from "../../core/render";

const BASE = ".cm-stage *{box-sizing:border-box;margin:0}.cm-stage svg{display:block}";

/** Non-interactive scaled slide. `children` render in unscaled slide coords on top. */
export function SlideView({ doc, project, index, scale, assetBase, animate, active, step = 0, children, stageRef }: {
  doc: Carousel;
  project: string;
  index: number;
  scale: number;
  /** where `assets/<file>` resolves; defaults to the project's asset route (trash page points elsewhere) */
  assetBase?: string;
  /** present mode: entrance animations + stepped reveal. `active` starts them, `step` is how many reveals have happened. */
  animate?: boolean;
  active?: boolean;
  step?: number;
  children?: ReactNode;
  stageRef?: React.Ref<HTMLDivElement>;
}) {
  const { width, height } = FORMATS[doc.format];
  const slide = doc.slides[index];
  const html = useMemo(
    () => (slide ? renderSlideBody(slide, doc, { assetBase: assetBase ?? `/api/projects/${encodeURIComponent(project)}/assets`, animate }) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide, doc.tokens, doc.format, project, assetBase, animate],
  );
  // step/active live on a wrapper attribute so changing them never rewrites `html` (that would restart every animation)
  const present = animate && slide ? { css: ANIM_CSS + stepCss(maxStep(slide)), t: slide.transition } : null;
  return (
    <div style={{ width: width * scale, height: height * scale, position: "relative", overflow: "hidden" }}>
      <div
        className="cm-stage"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute" }}
      >
        <style>{doc.tokens.css + BASE + (present?.css ?? "")}</style>
        {present ? (
          <div data-active={!!active} data-cur={step} data-t={present.t !== "slide" ? present.t : undefined} style={{ width, height }}>
            <div ref={stageRef} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : (
          <div ref={stageRef} dangerouslySetInnerHTML={{ __html: html }} />
        )}
        {children}
      </div>
    </div>
  );
}
