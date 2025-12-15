/* global QRCodeStyling */
document.addEventListener("DOMContentLoaded", () => {
  // ---------------- helpers ----------------
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function normalizeHex(v){
    if(!v) return null;
    v = String(v).trim();
    if(!v.startsWith("#")) v = "#" + v;
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v.toLowerCase() : null;
  }

  // ================== BRAND DEFAULTS (HIER ÄNDERN) ==================
  const DEFAULTS = {
    url: "https://standortstark.de",
    size: 420,
    margin: 12,
    ecc: "M",

    qrBgMode: "solid",     // "solid" | "transparent" (transparent wird für Preview intern auf weiß gemappt)
    qrBg: "#ffffff",

    fgMode: "solid",       // "solid" | "gradient-linear" | "gradient-radial" | "multicolor"
    c1: "#0b1220",         // Anthrazit
    c2: "#ff8a00",         // Orange
    c3: "#ffb15a",         // Orange hell

    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",

    logoSize: 0.22,
    logoHideBg: true,
    logoMargin: 6,

    frameOn: "on",         // "on" | "off"
    frameStyle: "soft",    // "soft" | "sharp" | "glass"
    frameColor: "#ff8a00",
    ctaText: "SCAN ME",
    ctaPos: "bottom",
    ctaColor: "#ffffff",

    // NEW: CTA typography controls
    ctaFontSize: 12,       // px
    ctaFontFamily: "system"// "system" | "inter" | "poppins" | "mono"
  };
  // ================================================================

  // ---------------- DOM ----------------
  const els = {
    status: $("statusPill"),
    toast: $("toast"),
    meta: $("meta"),
    shareOut: $("shareOut"),

    type: $("type"),
    data: $("data"),
    dataHint: $("dataHint"),

    dotType: $("dotType"),
    cornerSquareType: $("cornerSquareType"),
    cornerDotType: $("cornerDotType"),
    ecc: $("ecc"),

    size: $("size"), sizeVal: $("sizeVal"),
    margin: $("margin"), marginVal: $("marginVal"),

    bgMode: $("bgMode"),
    bgColor: $("bgColor"), bgHex: $("bgHex"),

    fgMode: $("fgMode"),
    fgColor1: $("fgColor1"), fgHex1: $("fgHex1"),
    fgColor2: $("fgColor2"), fgHex2: $("fgHex2"),
    fgColor3: $("fgColor3"), fgHex3: $("fgHex3"),
    fgExtraRow: $("fgExtraRow"),

    glow: $("glow"), glowVal: $("glowVal"),
    scale: $("scale"),

    logoFile: $("logoFile"),
    logoSize: $("logoSize"), logoSizeVal: $("logoSizeVal"),
    logoHideBg: $("logoHideBg"),
    logoMargin: $("logoMargin"), logoMarginVal: $("logoMarginVal"),

    frameOn: $("frameOn"),
    frameStyle: $("frameStyle"),
    ctaText: $("ctaText"),
    ctaPos: $("ctaPos"),
    frameColor: $("frameColor"), frameHex: $("frameHex"),
    ctaColor: $("ctaColor"), ctaHex: $("ctaHex"),

    // NEW: CTA typography dropdowns
    ctaFontSize: $("ctaFontSize"),
    ctaFontFamily: $("ctaFontFamily"),

    frame: $("frame"),
    cta: $("cta"),
    stage: $("stage"),
    mount: $("qrMount"),

    btnDownload: $("btnDownload"),
    btnCopy: $("btnCopy"),
    btnReset: $("btnReset"),
    btnShare: $("btnShare"),
    btnTest: $("btnTest"),
    btnExportSvg: $("btnExportSvg"),
  };

  // ---------------- UI feedback ----------------
  function toast(msg){
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1400);
  }

  function setStatus(text, tone="neutral"){
    if (!els.status) return;
    els.status.textContent = text;
    els.status.style.color =
      tone === "ok" ? "#38d37a" :
      tone === "warn" ? "#ffcc66" :
      "rgba(255,255,255,.62)";
  }

  // ---------------- hard guards ----------------
  if (!els.mount) {
    console.error("FEHLT: <div id='qrMount'></div> im HTML.");
    setStatus("Vorschau-Mount fehlt", "warn");
    return;
  }

  if (!window.QRCodeStyling) {
    console.error("QR Lib fehlt: qr-code-styling CDN wird nicht geladen oder falsche Reihenfolge.");
    setStatus("QR Lib fehlt", "warn");
    return;
  }

  // ---------------- Color sync (picker <-> hex) ----------------
  function bindColorPair(colorEl, hexEl){
    if (!colorEl || !hexEl) return;

    const start = normalizeHex(hexEl.value) || normalizeHex(colorEl.value) || "#ffffff";
    colorEl.value = start;
    hexEl.value = start;

    on(colorEl, "input", () => {
      hexEl.value = String(colorEl.value).toLowerCase();
      update();
    });

    on(hexEl, "input", () => {
      const hx = normalizeHex(hexEl.value);
      if (hx) { colorEl.value = hx; update(); }
    });
  }

  bindColorPair(els.bgColor, els.bgHex);
  bindColorPair(els.fgColor1, els.fgHex1);
  bindColorPair(els.fgColor2, els.fgHex2);
  bindColorPair(els.fgColor3, els.fgHex3);
  bindColorPair(els.frameColor, els.frameHex);
  bindColorPair(els.ctaColor, els.ctaHex);

  // ---------------- State ----------------
  const state = { logoDataUrl: null, updating: false };

  // ---------------- QR Instance ----------------
  const qr = new QRCodeStyling({
    width: DEFAULTS.size,
    height: DEFAULTS.size,
    type: "canvas",
    data: DEFAULTS.url,
    margin: DEFAULTS.margin,
    qrOptions: { errorCorrectionLevel: DEFAULTS.ecc },

    backgroundOptions: { color: DEFAULTS.qrBg },
    dotsOptions: { type: DEFAULTS.dotType, color: DEFAULTS.c1 },
    cornersSquareOptions: { type: DEFAULTS.cornerSquareType, color: DEFAULTS.c1 },
    cornersDotOptions: { type: DEFAULTS.cornerDotType, color: DEFAULTS.c1 },

    imageOptions: { hideBackgroundDots: DEFAULTS.logoHideBg, imageSize: DEFAULTS.logoSize, margin: DEFAULTS.logoMargin }
  });

  function mountQr(){
    els.mount.innerHTML = "";
    qr.append(els.mount);

    // stacking: Frame/CTA immer über QR
    els.mount.style.position = "relative";
    els.mount.style.zIndex = "1";
    if (els.stage) els.stage.style.position = "relative";
    if (els.frame) { els.frame.style.position = "absolute"; els.frame.style.zIndex = "5"; }
    if (els.cta)   { els.cta.style.position = "absolute";   els.cta.style.zIndex = "6"; }
  }

  mountQr();

  // ---------------- defaults into UI ----------------
  function applyDefaultsToUI(){
    if (els.data) els.data.value = DEFAULTS.url;

    if (els.size) els.size.value = String(DEFAULTS.size);
    if (els.margin) els.margin.value = String(DEFAULTS.margin);
    if (els.ecc) els.ecc.value = DEFAULTS.ecc;

    if (els.bgMode) els.bgMode.value = DEFAULTS.qrBgMode;
    if (els.bgColor) els.bgColor.value = DEFAULTS.qrBg;
    if (els.bgHex) els.bgHex.value = DEFAULTS.qrBg;

    if (els.fgMode) els.fgMode.value = DEFAULTS.fgMode;
    if (els.fgColor1) els.fgColor1.value = DEFAULTS.c1;
    if (els.fgHex1) els.fgHex1.value = DEFAULTS.c1;
    if (els.fgColor2) els.fgColor2.value = DEFAULTS.c2;
    if (els.fgHex2) els.fgHex2.value = DEFAULTS.c2;
    if (els.fgColor3) els.fgColor3.value = DEFAULTS.c3;
    if (els.fgHex3) els.fgHex3.value = DEFAULTS.c3;

    if (els.dotType) els.dotType.value = DEFAULTS.dotType;
    if (els.cornerSquareType) els.cornerSquareType.value = DEFAULTS.cornerSquareType;
    if (els.cornerDotType) els.cornerDotType.value = DEFAULTS.cornerDotType;

    if (els.logoSize) els.logoSize.value = String(DEFAULTS.logoSize);
    if (els.logoHideBg) els.logoHideBg.value = DEFAULTS.logoHideBg ? "true" : "false";
    if (els.logoMargin) els.logoMargin.value = String(DEFAULTS.logoMargin);

    if (els.frameOn) els.frameOn.value = DEFAULTS.frameOn;
    if (els.frameStyle) els.frameStyle.value = DEFAULTS.frameStyle;
    if (els.ctaText) els.ctaText.value = DEFAULTS.ctaText;
    if (els.ctaPos) els.ctaPos.value = DEFAULTS.ctaPos;

    if (els.frameColor) els.frameColor.value = DEFAULTS.frameColor;
    if (els.frameHex) els.frameHex.value = DEFAULTS.frameColor;

    if (els.ctaColor) els.ctaColor.value = DEFAULTS.ctaColor;
    if (els.ctaHex) els.ctaHex.value = DEFAULTS.ctaColor;

    // NEW typography defaults
    if (els.ctaFontSize) els.ctaFontSize.value = String(DEFAULTS.ctaFontSize);
    if (els.ctaFontFamily) els.ctaFontFamily.value = DEFAULTS.ctaFontFamily;
  }

  applyDefaultsToUI();

  // ---------------- logic ----------------
  function normalizeData(){
    const raw = (els.data?.value || "").trim();
    const t = (els.type?.value || "url");

    if (!raw) return { ok:false, data:"", hint:"Bitte Inhalt eingeben." };

    if (t === "url") {
      const looksLikeScheme = /^(https?:\/\/|mailto:|tel:|sms:|bitcoin:|geo:|WIFI:|BEGIN:VCARD|BEGIN:VEVENT)/i.test(raw);
      if (!looksLikeScheme) return { ok:true, data:`https://${raw}`, hint:"https:// ergänzt" };
      return { ok:true, data:raw, hint:"URL aktiv" };
    }
    return { ok:true, data:raw, hint:"Text aktiv" };
  }

  function buildDotsColor(){
    const c1 = normalizeHex(els.fgHex1?.value) || els.fgColor1?.value || DEFAULTS.c1;
    const c2 = normalizeHex(els.fgHex2?.value) || els.fgColor2?.value || DEFAULTS.c2;
    const c3 = normalizeHex(els.fgHex3?.value) || els.fgColor3?.value || DEFAULTS.c3;

    const mode = els.fgMode?.value || DEFAULTS.fgMode;
    if (mode === "solid") return { color: c1 };

    const gradientType = (mode === "gradient-radial" || mode === "multicolor") ? "radial" : "linear";
    return {
      gradient: {
        type: gradientType,
        rotation: 0,
        colorStops: [
          { offset: 0, color: c1 },
          { offset: 0.5, color: c2 },
          { offset: 1, color: c3 },
        ]
      }
    };
  }

  function showFgExtras(){
    if (!els.fgExtraRow || !els.fgMode) return;
    els.fgExtraRow.style.display = (els.fgMode.value !== "solid") ? "grid" : "none";
  }

  function applyFrameAndCta(){
    if (!els.frame || !els.cta || !els.frameOn) return;

    if (els.frameOn.value !== "on") {
      els.frame.classList.add("hidden");
      return;
    }
    els.frame.classList.remove("hidden");

    const frameCol = normalizeHex(els.frameHex?.value) || els.frameColor?.value || DEFAULTS.frameColor;
    const ctaCol   = normalizeHex(els.ctaHex?.value)   || els.ctaColor?.value   || DEFAULTS.ctaColor;
    const style    = els.frameStyle?.value || DEFAULTS.frameStyle;

    els.frame.style.inset = "18px";
    els.frame.style.pointerEvents = "none";

    if (style === "glass") {
      els.frame.style.border = "1px solid rgba(255,255,255,.18)";
      els.frame.style.background = "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.05))";
      els.frame.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.10), 0 18px 60px rgba(0,0,0,.35)";
      els.frame.style.borderRadius = "22px";
    } else if (style === "sharp") {
      els.frame.style.border = `2px solid ${frameCol}`;
      els.frame.style.background = "transparent";
      els.frame.style.boxShadow = "0 18px 60px rgba(0,0,0,.35)";
      els.frame.style.borderRadius = "12px";
    } else {
      els.frame.style.border = `2px solid ${frameCol}`;
      els.frame.style.background = "transparent";
      els.frame.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,.10), 0 18px 60px rgba(0,0,0,.35)";
      els.frame.style.borderRadius = "22px";
    }

    els.cta.textContent = (els.ctaText?.value || DEFAULTS.ctaText).trim() || DEFAULTS.ctaText;
    const pos = (els.ctaPos?.value === "top") ? "top" : "bottom";
    els.cta.className = `cta ${pos}`;

    els.cta.style.backgroundColor = (style === "glass") ? "rgba(0,0,0,.35)" : frameCol;
    els.cta.style.color = ctaCol;
    els.cta.style.border = "1px solid rgba(255,255,255,.16)";
    els.cta.style.backdropFilter = "blur(10px)";

    // ---- NEW: CTA Typography (safe overlay only) ----
    const fs = parseInt(els.ctaFontSize?.value || DEFAULTS.ctaFontSize, 10);
    els.cta.style.fontSize = `${clamp(fs || DEFAULTS.ctaFontSize, 9, 22)}px`;

    const fam = (els.ctaFontFamily?.value || DEFAULTS.ctaFontFamily);
    els.cta.style.fontFamily =
      fam === "inter" ? "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" :
      fam === "poppins" ? "Poppins, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" :
      fam === "mono" ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" :
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  }

  function update(){
    if (state.updating) return;
    state.updating = true;

    try{
      const norm = normalizeData();
      setText(els.dataHint, norm.hint);

      setText(els.sizeVal, String(els.size?.value ?? ""));
      setText(els.marginVal, String(els.margin?.value ?? ""));
      setText(els.glowVal, String(els.glow?.value ?? ""));
      setText(els.logoSizeVal, els.logoSize ? Number(els.logoSize.value).toFixed(2) : "");
      setText(els.logoMarginVal, String(els.logoMargin?.value ?? ""));

      showFgExtras();

      const size = clamp(parseInt(els.size?.value, 10) || DEFAULTS.size, 180, 900);
      const margin = clamp(parseInt(els.margin?.value, 10) || DEFAULTS.margin, 0, 40);
      const ecc = els.ecc?.value || DEFAULTS.ecc;

      // preview-safe: transparent => white (sonst „verschwindet“ QR auf dunklem UI)
      const bgMode = els.bgMode?.value || DEFAULTS.qrBgMode;
      const bgColor =
        bgMode === "transparent"
          ? DEFAULTS.qrBg
          : (normalizeHex(els.bgHex?.value) || els.bgColor?.value || DEFAULTS.qrBg);

      const primary = normalizeHex(els.fgHex1?.value) || els.fgColor1?.value || DEFAULTS.c1;

      qr.update({
        width: size,
        height: size,
        data: norm.ok ? norm.data : "",
        margin,
        qrOptions: { errorCorrectionLevel: ecc },
        backgroundOptions: { color: bgColor },

        dotsOptions: { type: els.dotType?.value || DEFAULTS.dotType, ...buildDotsColor() },
        cornersSquareOptions: { type: els.cornerSquareType?.value || DEFAULTS.cornerSquareType, color: primary },
        cornersDotOptions: { type: els.cornerDotType?.value || DEFAULTS.cornerDotType, color: primary },

        image: state.logoDataUrl || undefined,
        imageOptions: {
          hideBackgroundDots: (els.logoHideBg?.value ?? (DEFAULTS.logoHideBg ? "true" : "false")) === "true",
          imageSize: clamp(parseFloat(els.logoSize?.value) || DEFAULTS.logoSize, 0, 0.42),
          margin: clamp(parseInt(els.logoMargin?.value, 10) || DEFAULTS.logoMargin, 0, 20)
        }
      });

      applyFrameAndCta();
      setText(els.meta, `${size}px • ECC ${ecc} • ${els.fgMode?.value || DEFAULTS.fgMode}`);
      setStatus("Ready", "ok");
    } catch(e){
      console.error(e);
      setStatus("Render Error", "warn");
      toast("Render Error – Konsole checken");
    } finally {
      state.updating = false;
    }
  }

  // ---------------- events (crash-safe) ----------------
  const liveIds = [
    "type","data",
    "dotType","cornerSquareType","cornerDotType","ecc",
    "size","margin","bgMode","fgMode","glow","scale",
    "logoSize","logoHideBg","logoMargin",
    "frameOn","frameStyle","ctaText","ctaPos",
    // NEW typography controls
    "ctaFontSize","ctaFontFamily"
  ];
  liveIds.forEach(id => {
    const el = $(id);
    on(el, "input", update);
    on(el, "change", update);
  });

  on(els.logoFile, "change", () => {
    const f = els.logoFile.files?.[0];
    if (!f) { state.logoDataUrl = null; update(); return; }
    const r = new FileReader();
    r.onload = () => { state.logoDataUrl = r.result; toast("Logo geladen"); update(); };
    r.readAsDataURL(f);
  });

  on(els.btnDownload, "click", async () => {
    try{
      setStatus("Export…", "neutral");
      await qr.download({ extension: "png", name: `qr_${Date.now()}` });
      setStatus("Downloaded", "ok");
      toast("PNG exportiert");
    } catch(e){
      console.error(e);
      setStatus("Export Error", "warn");
      toast("PNG Export fehlgeschlagen");
    }
  });

  on(els.btnExportSvg, "click", async () => {
    try{
      setStatus("Export…", "neutral");
      await qr.download({ extension: "svg", name: `qr_${Date.now()}` });
      setStatus("SVG Ready", "ok");
      toast("SVG exportiert");
    } catch(e){
      console.error(e);
      setStatus("SVG Error", "warn");
      toast("SVG Export fehlgeschlagen");
    }
  });

  on(els.btnCopy, "click", async () => {
    try{
      setStatus("Copy…", "neutral");
      const blob = await qr.getRawData("png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Copied", "ok");
      toast("QR kopiert");
    } catch(e){
      console.error(e);
      setStatus("Copy Error", "warn");
      toast("Clipboard blockiert (Browser/HTTPS)");
    }
  });

  on(els.btnReset, "click", () => location.reload());
  on(els.btnTest, "click", () => toast("Scan-Test: Kamera-App / Google Lens. Mit Logo => ECC Q/H."));

  // ---------------- boot ----------------
  update();
});
