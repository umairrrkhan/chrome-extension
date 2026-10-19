(() => {
  const id = "smallwindow-trade-host";
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
    return;
  }
  const host = document.createElement("div");
  host.id = id;
  host.style.cssText =
    "all:initial!important;position:fixed!important;top:24px!important;right:20px!important;width:366px!important;max-width:calc(100vw - 16px)!important;z-index:2147483647!important;color-scheme:normal!important;";
  const shadow = host.attachShadow({ mode: "closed" });
  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("app.html") + "#overlay";
  frame.title = "Smallwindow Trade market watch";
  frame.allow = "";
  frame.style.cssText =
    "width:100%;height:650px;max-height:calc(100dvh - 48px);border:0;border-radius:18px;box-shadow:0 16px 70px #0006;display:block;color-scheme:normal;";
  const handle = document.createElement("button");
  handle.textContent = "⠿  Drag to move";
  handle.setAttribute(
    "aria-label",
    "Move market window with arrow keys or drag",
  );
  handle.style.cssText =
    "position:absolute;top:0;left:0;right:0;height:22px;border:0;border-radius:18px 18px 0 0;background:#202b2a;color:#9bafaa;font:10px system-ui;cursor:grab;touch-action:none;";
  shadow.append(frame, handle);
  document.documentElement.append(host);
  let x, y, left, top;
  const move = (l, t) => {
    host.style.setProperty(
      "left",
      `${Math.max(8, Math.min(l, innerWidth - host.offsetWidth - 8))}px`,
      "important",
    );
    host.style.setProperty(
      "top",
      `${Math.max(8, Math.min(t, innerHeight - 50))}px`,
      "important",
    );
    host.style.setProperty("right", "auto", "important");
  };
  handle.onpointerdown = (e) => {
    const r = host.getBoundingClientRect();
    x = e.clientX;
    y = e.clientY;
    left = r.left;
    top = r.top;
    handle.setPointerCapture(e.pointerId);
  };
  handle.onpointermove = (e) => {
    if (handle.hasPointerCapture(e.pointerId))
      move(left + e.clientX - x, top + e.clientY - y);
  };
  handle.onkeydown = (e) => {
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const r = host.getBoundingClientRect();
    move(
      r.left + (e.key === "ArrowRight" ? 16 : e.key === "ArrowLeft" ? -16 : 0),
      r.top + (e.key === "ArrowDown" ? 16 : e.key === "ArrowUp" ? -16 : 0),
    );
  };
  const resize = () => {
    if (!host.isConnected) {
      window.removeEventListener("resize", resize);
      return;
    }
    const r = host.getBoundingClientRect();
    move(r.left, r.top);
  };
  window.addEventListener("resize", resize);
  const listener = (e) => {
    if (!host.isConnected) {
      window.removeEventListener("message", listener);
      return;
    }
    if (
      e.source !== frame.contentWindow ||
      e.origin !== chrome.runtime.getURL("").replace(/\/$/, "")
    )
      return;
    if (e.data?.type === "swt-close") host.remove();
    if (e.data?.type === "swt-size")
      frame.style.height = `${Math.max(86, Math.min(780, Number(e.data.height) || 650))}px`;
  };
  window.addEventListener("message", listener);
})();
