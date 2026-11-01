import { FORMATS, type Carousel } from "./schema.ts";
import { ANIM_CSS, maxStep, renderSlideBody, stepCss } from "./render.ts";
import { IMAGE_TYPES, readAsset } from "./projects.ts";
import { fontsDir, readFontFile } from "./fonts.ts";
import { fontFaceCss } from "./fontUtil.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Reads every `assets/<file>` an image element uses and returns file -> data URI. Missing files are skipped (src stays as is). */
async function inlineAssets(c: Carousel, project?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!project) return out;
  const names = new Set<string>();
  for (const s of c.slides) for (const e of s.elements) if (e.type === "image" && e.src.startsWith("assets/")) names.add(e.src.slice("assets/".length));
  for (const name of names) {
    try {
      const type = IMAGE_TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
      out.set(name, `data:${type};base64,${(await readAsset(project, name)).toString("base64")}`);
    } catch {
      /* missing asset: leave the original src */
    }
  }
  return out;
}

/** file -> data URI for every attached font, so the exported file needs no network for them. */
async function inlineFonts(c: Carousel, project?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!project) return out;
  for (const f of c.tokens.fontFiles) {
    try {
      const { data, type } = await readFontFile(fontsDir(project), f);
      out.set(f, `data:${type};base64,${data.toString("base64")}`);
    } catch {
      /* missing font file: falls back like in the editor */
    }
  }
  return out;
}

const PLAYER_CSS = `
*{box-sizing:border-box;margin:0}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
svg{display:block}
#frame{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
.w{position:absolute;inset:0;display:none}
.w[data-active="true"]{display:block}
#bar{position:fixed;left:0;bottom:0;height:3px;background:rgba(255,255,255,.55);transition:width .3s}
@keyframes cm-t-slide{from{opacity:0;translate:10% 0}}
@keyframes cm-t-slide-back{from{opacity:0;translate:-10% 0}}
body[data-nav] .w[data-active="true"][data-t="slide"]{animation:cm-t-slide 380ms cubic-bezier(.22,.8,.3,1) both}
body[data-dir="-1"][data-nav] .w[data-active="true"][data-t="slide"]{animation-name:cm-t-slide-back}
@media (prefers-reduced-motion:reduce){.w,.cm-a{animation:none!important}}
`;

/** Plain ES5-ish runtime: fit-to-window, keys / click / swipe, stepped reveals, #n deep links. */
const PLAYER_JS = `(function(){
var W=+document.body.dataset.w,H=+document.body.dataset.h;
var frame=document.getElementById('frame'),bar=document.getElementById('bar');
var ws=[].slice.call(document.querySelectorAll('.w')),N=ws.length,i=0,cur=0;
function fit(){var s=Math.min(innerWidth/W,innerHeight/H);frame.style.transform='translate('+(innerWidth-W*s)/2+'px,'+(innerHeight-H*s)/2+'px) scale('+s+')'}
function show(n,c,dir){
  if(n!==i){ws[i].dataset.active='false';document.body.dataset.nav='1';document.body.dataset.dir=dir;i=n}
  cur=c;ws[i].dataset.cur=c;ws[i].dataset.active='true';
  bar.style.width=((i+1)/N*100)+'%';
  history.replaceState(null,'','#'+(i+1));
}
function next(){var m=+ws[i].dataset.max;if(cur<m)show(i,cur+1,1);else if(i<N-1)show(i+1,0,1)}
function prev(){if(cur>0)show(i,cur-1,-1);else if(i>0)show(i-1,+ws[i-1].dataset.max,-1)}
function go(n){n=Math.max(0,Math.min(N-1,n));show(n,0,n<i?-1:1)}
addEventListener('keydown',function(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  var k=e.key;
  if(k==='ArrowRight'||k==='ArrowDown'||k==='PageDown'||k===' '||k==='Enter')next();
  else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace')prev();
  else if(k==='Home')go(0);else if(k==='End')go(N-1);
  else if(k==='f'||k==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()}
  else return;
  e.preventDefault();
});
addEventListener('click',function(e){
  if(e.target.closest&&e.target.closest('a,button,input,textarea,select'))return;
  e.clientX<innerWidth*0.3?prev():next();
});
var tx=null;
addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
addEventListener('touchend',function(e){
  if(tx==null)return;var dx=e.changedTouches[0].clientX-tx;tx=null;
  if(Math.abs(dx)>50){dx<0?next():prev();e.preventDefault()}
});
addEventListener('resize',fit);
addEventListener('hashchange',function(){var n=(parseInt(location.hash.slice(1),10)||1)-1;if(n!==i)go(n)});
fit();show(Math.max(0,Math.min(N-1,(parseInt(location.hash.slice(1),10)||1)-1)),0,1);
})();`;

/** One self-contained HTML file: all slides, images inlined, animations / steps / transitions as in the editor's Preview. */
export async function renderPresentHtml(c: Carousel, project?: string): Promise<string> {
  if (!c.slides.length) throw new Error("no slides to export");
  const { width, height } = FORMATS[c.format];
  const assets = await inlineAssets(c, project);
  const fonts = await inlineFonts(c, project);
  const opts = { animate: true, assetUrl: (f: string) => assets.get(f) ?? `assets/${f}` };
  const max = Math.max(0, ...c.slides.map(maxStep));
  const slides = c.slides
    .map((s, i) => `<div class="w" data-i="${i}" data-active="false" data-cur="0" data-max="${maxStep(s)}" data-t="${s.transition ?? "slide"}">${renderSlideBody(s, c, opts)}</div>`)
    .join("\n");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title || project || "Presentasi")}</title>
<style>${c.tokens.css}
${fontFaceCss([...fonts.keys()], (f) => fonts.get(f)!)}</style>
<style>${PLAYER_CSS}${ANIM_CSS}${stepCss(max)}</style>
</head><body data-w="${width}" data-h="${height}">
<div id="frame" style="width:${width}px;height:${height}px">
${slides}
</div>
<div id="bar"></div>
<script>${PLAYER_JS}</script>
</body></html>`;
}
