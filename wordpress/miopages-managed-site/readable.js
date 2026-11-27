/* Design rule 4 (Readable), guaranteed by the theme: wherever text would not read against the
   background behind it, the theme sets it to the site's own dark or light text color, whichever
   reads. Core's design is otherwise untouched. No AI involved; computed on the page itself. */
(() => {
  if (!document.body.classList.contains("miopages-designed")) return;
  const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = value => {
    pixel.clearRect(0, 0, 1, 1); pixel.fillStyle = "#000"; pixel.fillStyle = value; pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a) });
  const ratio = (a, b) => { const x = lum(a) + 0.05, y = lum(b) + 0.05; return Math.max(x, y) / Math.min(x, y); };
  const layersOf = image => {
    const out = []; let depth = 0, start = 0;
    for (let i = 0; i < image.length; i++) {
      if (image[i] === "(") depth++; else if (image[i] === ")") depth--;
      else if (image[i] === "," && depth === 0) { out.push(image.slice(start, i)); start = i + 1; }
    }
    out.push(image.slice(start));
    return out;
  };
  // The possible colors behind an element, worst case first; null when a photograph is behind it.
  const backgrounds = el => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.backgroundImage.includes("url(")) return null;
      let covered = false;
      if (s.backgroundImage !== "none") for (const image of layersOf(s.backgroundImage)) {
        const stops = (image.match(/(rgba?|color)\([^()]*\)/g) || []).map(parse);
        if (!stops.length) continue;
        layers.push(stops);
        if (stops.every(stop => stop.a >= 1)) { covered = true; break; }
      }
      if (covered) break;
      const bg = parse(s.backgroundColor);
      if (bg.a > 0) { layers.push([bg]); if (bg.a >= 1) break; }
    }
    let backs = [{ r: 255, g: 255, b: 255 }];
    for (const layer of layers.reverse()) backs = layer.flatMap(stop => backs.map(back => blend(stop, back))).slice(0, 64);
    return backs;
  };
  const root = getComputedStyle(document.body);
  const candidates = [root.getPropertyValue("--wp--preset--color--ink").trim() || "#111111",
    root.getPropertyValue("--wp--preset--color--surface").trim() || "#ffffff", "#111111", "#ffffff"];
  const fix = () => {
    const texts = document.querySelectorAll("main p, main li, main h1, main h2, main h3, main h4, main h5, main h6, main a, main span, main blockquote, main cite, main figcaption, header a, header span, footer a, footer p, footer li");
    for (const el of texts) {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize), needed = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
      const backs = backgrounds(el);
      if (!backs) continue;
      const worst = color => Math.min(...backs.map(back => ratio(blend(parse(color), back), back)));
      if (worst(style.color) >= needed) continue;
      const best = candidates.map(color => ({ color, score: worst(color) })).sort((a, b) => b.score - a.score)[0];
      if (best && best.score > worst(style.color)) el.style.setProperty("color", best.color, "important");
    }
  };
  const run = () => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fix); else fix(); };
  window.addEventListener("load", run);
  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(fix, 150); });
  run();
})();
