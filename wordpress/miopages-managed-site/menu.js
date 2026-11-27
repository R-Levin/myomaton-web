/* The site menu: text links that switch to a phone menu when they would wrap to two lines
   (design rule 5; the Principal, Nov 27). The theme's own script; nothing Core wrote runs. */
(() => {
  const header = document.querySelector("header.wp-block-template-part");
  const box = header && header.querySelector(".miopages-menu");
  const nav = box && box.querySelector("nav.miopages-draft-nav");
  const button = box && box.querySelector(".miopages-menu-toggle");
  if (!nav || !button || !nav.children.length) return;
  const words = window.miopagesMenu || { open: "Open menu", close: "Close menu" };
  const root = document.documentElement;
  const isOpen = () => header.classList.contains("miopages-menu-open");

  const setOpen = open => {
    if (open) root.style.setProperty("--mp-menu-top", Math.max(0, Math.round(header.getBoundingClientRect().bottom)) + "px");
    header.classList.toggle("miopages-menu-open", open);
    root.classList.toggle("miopages-menu-locked", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? words.close : words.open);
  };

  // Lay the links out as plain text on one wrapping line, and see whether any drops to a second line.
  // Measured with the phone-menu states lifted and restored in the same frame, so nothing flickers.
  const wraps = () => {
    const states = ["miopages-menu-compact", "miopages-menu-open"].filter(name => header.classList.contains(name));
    header.classList.remove(...states);
    header.classList.add("miopages-menu-measuring");
    const boxes = [...nav.children].map(item => item.getBoundingClientRect());
    const top = Math.min(...boxes.map(box => box.top)), line = Math.min(...boxes.map(box => box.height));
    const wrapped = boxes.some(box => box.top - top > line / 2) || nav.scrollWidth > nav.clientWidth + 1;
    header.classList.remove("miopages-menu-measuring");
    header.classList.add(...states);
    return wrapped;
  };

  let pending = false;
  const update = () => {
    pending = false;
    const compact = wraps();
    if (compact !== header.classList.contains("miopages-menu-compact")) header.classList.toggle("miopages-menu-compact", compact);
    if (!compact && isOpen()) setOpen(false);
  };
  const schedule = () => { if (!pending) { pending = true; setTimeout(update, 60); } };

  button.addEventListener("click", () => setOpen(!isOpen()));
  nav.addEventListener("click", event => { if (event.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen()) { setOpen(false); button.focus(); }
  });
  window.addEventListener("resize", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  header.classList.add("miopages-menu-ready");
  update();
})();
