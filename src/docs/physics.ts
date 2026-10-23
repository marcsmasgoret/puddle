// The physics write-up page: renders docs/physics.md (the same file that
// reads well on GitHub) with KaTeX for the equations.
import './docs.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { marked } from 'marked';
import source from '../../docs/physics.md?raw';

// Pull the maths out before Markdown sees it (underscores and asterisks in
// TeX would otherwise turn into emphasis), typeset it, then put it back.
const math: string[] = [];
const stash = (tex: string, display: boolean) => {
  math.push(katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' }));
  return `MATHPH${math.length - 1}X`;
};
let md = source
  .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(tex, true))
  .replace(/\$([^$\n]+?)\$/g, (_, tex) => stash(tex, false));

// the first heading becomes the page title block
md = md.replace(/^# .*\n/, '');
const html = (marked.parse(md, { async: false }) as string).replace(/MATHPH(\d+)X/g, (_, i) => math[+i]);

const body = document.querySelector<HTMLElement>('#doc')!;
body.innerHTML = html;
// heading anchors, so sections can be linked to
body.querySelectorAll('h2, h3').forEach((h) => {
  h.id = h.textContent!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
});
