
(() => {
  const STORAGE_KEY = "stockpilot_v1";

  const $ = (id) => document.getElementById(id);
  const fmtEUR = (n) => new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR" }).format(n || 0);
  const fmtDate = (ts) => new Intl.DateTimeFormat("de-DE", {
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"
  }).format(new Date(ts));

  const uid = () => Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);

  const state = loadState();

  // Elements
  const itemsTbody = $("itemsTable").querySelector("tbody");
  const historyTbody = $("historyTable").querySelector("tbody");

  const formItem = $("formItem");
  const formMove = $("formMove");

  const moveItem = $("moveItem");
  const moveType = $("moveType");
  const search = $("search");
  const filterStock = $("filterStock");

  const modal = $("modal");
  const modalClose = $("modalClose");
  const modalForm = $("modalForm");

  // Init
  hydrateUI();

  // --- Events: Add Item ---
  formItem.addEventListener("submit", (e) => {
    e.preventDefault();

    const sku = $("sku").value.trim();
    const name = $("name").value.trim();
    const category = $("category").value.trim();
    const supplier = $("supplier").value.trim();
    const cost = toNum($("cost").value);
    const price = toNum($("price").value);
    const initialStock = toInt($("initialStock").value);

    if (!sku || !name) return toast("SKU und Name sind Pflicht.");
    if (existsSku(sku)) return toast("SKU existiert bereits. Bitte eindeutig halten.");
    if (cost < 0 || price < 0) return toast("Preise dürfen nicht negativ sein.");
    if (initialStock < 0) return toast("Startbestand darf nicht negativ sein.");

    const item = { id: uid(), sku, name, category, supplier, cost, price, stock: initialStock };
    state.items.push(item);

    // Optional: Startbestand als Bewegung loggen (audit)
    if (initialStock > 0) {
      state.moves.unshift({
        id: uid(),
        ts: Date.now(),
        type: "adjust",
        itemId: item.id,
        qty: initialStock,
        unit: cost,
        note: "Startbestand"
      });
    }

    persist();
    formItem.reset();
    $("initialStock").value = "0";
    hydrateUI();
    toast("Artikel gespeichert.");
  });

  // Demo Data
  $("btnDemo").addEventListener("click", () => {
    if (state.items.length) return toast("Demo nur sinnvoll in leerem System (oder reset).");
    const demo = [
      { sku:"A-1001", name:"Schrauben M6 (100er)", category:"Zubehör", supplier:"Fix&Co", cost:4.20, price:8.90, stock:25 },
      { sku:"B-2002", name:"Kabelbinder (50er)", category:"Zubehör", supplier:"Fix&Co", cost:2.10, price:5.50, stock:8 },
      { sku:"C-3003", name:"WD-40 400ml", category:"Werkstatt", supplier:"IndustriePartner", cost:3.30, price:7.90, stock:3 },
    ];
    demo.forEach(d => state.items.push({ id: uid(), ...d }));
    state.moves.unshift({
      id: uid(), ts: Date.now(), type: "adjust",
      itemId: state.items[0].id, qty: 25, unit: 4.20, note: "Startbestand"
    });
    persist();
    hydrateUI();
    toast("Demo-Daten geladen.");
  });

  // --- Events: Movement ---
  formMove.addEventListener("submit", (e) => {
    e.preventDefault();

    const itemId = moveItem.value;
    const type = moveType.value;
    const qty = toInt($("moveQty").value);
    const unitRaw = $("moveUnit").value.trim();
    const note = $("moveNote").value.trim();

    const item = state.items.find(i => i.id === itemId);
    if (!item) return toast("Artikel nicht gefunden.");
    if (!Number.isFinite(qty) || qty === 0) return toast("Menge muss eine Zahl ungleich 0 sein.");

    let signedQty = qty;
    if (type === "purchase") signedQty = Math.abs(qty);
    if (type === "sale") signedQty = -Math.abs(qty);
    // adjust: qty as given (can be +/-)

    // Unit price fallback
    let unit = unitRaw === "" ? (type === "sale" ? item.price : item.cost) : toNum(unitRaw);
    if (unit < 0) return toast("Stückpreis darf nicht negativ sein.");

    // Stock check for sales
    if (signedQty < 0 && item.stock + signedQty < 0) {
      return toast("Nicht genug Bestand für diesen Verkauf.");
    }

    // Apply stock change
    item.stock += signedQty;

    // Log move
    state.moves.unshift({
      id: uid(),
      ts: Date.now(),
      type,
      itemId: item.id,
      qty: signedQty,
      unit,
      note
    });

    persist();
    formMove.reset();
    $("moveQty").value = "1";
    hydrateUI();
    toast("Buchung gespeichert.");
  });

  // Search / filter
  search.addEventListener("input", hydrateUI);
  filterStock.addEventListener("change", hydrateUI);

  // Export / Import / Reset
  $("btnExport").addEventListener("click", exportCSV);
  $("fileImport").addEventListener("change", importCSV);
  $("btnReset").addEventListener("click", () => {
    const ok = confirm("Wirklich alles löschen? Artikel + Historie werden entfernt.");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  $("btnClearHistory").addEventListener("click", () => {
    const ok = confirm("Historie wirklich leeren? Bestände bleiben wie sie sind.");
    if (!ok) return;
    state.moves = [];
    persist();
    hydrateUI();
  });

  modalClose.addEventListener("click", () => closeModal());
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = $("editId").value;
    const item = state.items.find(i => i.id === id);
    if (!item) return toast("Artikel nicht gefunden.");

    const newSku = $("editSku").value.trim();
    if (!newSku) return toast("SKU ist Pflicht.");
    if (newSku !== item.sku && existsSku(newSku)) return toast("SKU existiert bereits.");

    item.sku = newSku;
    item.name = $("editName").value.trim();
    item.category = $("editCategory").value.trim();
    item.supplier = $("editSupplier").value.trim();
    item.cost = toNum($("editCost").value);
    item.price = toNum($("editPrice").value);
    item.stock = toInt($("editStock").value);

    persist();
    hydrateUI();
    closeModal();
    toast("Änderungen gespeichert.");

  });

  function hydrateUI(){

    // Select options
    moveItem.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = state.items.length ? "Artikel auswählen…" : "Keine Artikel vorhanden";
    opt0.disabled = true;
    opt0.selected = true;
    moveItem.appendChild(opt0);

    state.items
      .slice()
      .sort((a,b) => (a.sku.localeCompare(b.sku)))
      .forEach(i => {
        const opt = document.createElement("option");
        opt.value = i.id;
        opt.textContent = `${i.sku} — ${i.name} (Bestand: ${i.stock})`;
        moveItem.appendChild(opt);
      });

    renderItemsTable();
    renderHistoryTable();
    renderKPIs();
  }

  function renderItemsTable(){
    const q = search.value.trim().toLowerCase();
    const mode = filterStock.value;

    let items = state.items.slice();

    if (q) {
      items = items.filter(i => (
        i.sku.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.category||"").toLowerCase().includes(q) ||
        (i.supplier||"").toLowerCase().includes(q)
      ));
    }

    if (mode === "low") items = items.filter(i => i.stock <= 5);
    if (mode === "zero") items = items.filter(i => i.stock === 0);

    itemsTbody.innerHTML = "";

    if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9" class="muted">Keine Treffer.</td>`;
      itemsTbody.appendChild(tr);
      return;
    }

    items
      .sort((a,b) => a.sku.localeCompare(b.sku))
      .forEach(item => {
        const value = item.stock * item.cost;
        const low = item.stock <= 5 ? `<span class="badge">Low</span>` : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="badge">${escapeHtml(item.sku)}</span></td>
          <td>${escapeHtml(item.name)} ${low}</td>
          <td>${escapeHtml(item.category || "—")}</td>
          <td>${escapeHtml(item.supplier || "—")}</td>
          <td class="num">${fmtEUR(item.cost)}</td>
          <td class="num">${fmtEUR(item.price)}</td>
          <td class="num">${item.stock}</td>
          <td class="num">${fmtEUR(value)}</td>
          <td>
            <div class="actions-inline">
              <button class="btn btn-ghost small" data-act="edit" data-id="${item.id}">Bearbeiten</button>
              <button class="btn btn-danger small" data-act="del" data-id="${item.id}">Löschen</button>
            </div>
          </td>
        `;
        tr.querySelectorAll("button").forEach(btn => {
          btn.addEventListener("click", () => handleItemAction(btn.dataset.act, btn.dataset.id));
        });
        itemsTbody.appendChild(tr);
      });
  }

  function renderHistoryTable(){
    historyTbody.innerHTML = "";
    const moves = state.moves.slice();

    if (!moves.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9" class="muted">Noch keine Buchungen.</td>`;
      historyTbody.appendChild(tr);
      return;
    }

    moves.forEach(m => {
      const item = state.items.find(i => i.id === m.itemId);
      const name = item ? item.name : "Gelöschter Artikel";
      const sku = item ? item.sku : "—";
      const sum = (m.qty || 0) * (m.unit || 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(m.ts)}</td>
        <td>${typeLabel(m.type)}</td>
        <td><span class="badge">${escapeHtml(sku)}</span></td>
        <td>${escapeHtml(name)}</td>
        <td class="num">${m.qty}</td>
        <td class="num">${fmtEUR(m.unit)}</td>
        <td class="num">${fmtEUR(sum)}</td>
        <td>${escapeHtml(m.note || "—")}</td>
        <td>
          <button class="btn btn-danger small" data-id="${m.id}">Entfernen</button>
        </td>
      `;
      tr.querySelector("button").addEventListener("click", () => deleteMove(m.id));
      historyTbody.appendChild(tr);
    });
  }

  function renderKPIs(){
    $("kpiItems").textContent = String(state.items.length);

    const totalStock = state.items.reduce((a,i) => a + (i.stock||0), 0);
    $("kpiStock").textContent = String(totalStock);

    const totalValue = state.items.reduce((a,i) => a + (i.stock||0) * (i.cost||0), 0);
    $("kpiValue").textContent = fmtEUR(totalValue);

    const revenue = state.moves
      .filter(m => m.type === "sale")
      .reduce((a,m) => a + (Math.abs(m.qty||0) * (m.unit||0)), 0);
    $("kpiRevenue").textContent = fmtEUR(revenue);
  }

  function handleItemAction(act, id){
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    if (act === "edit") return openEdit(item);

    if (act === "del") {
      const ok = confirm(`Artikel "${item.sku} – ${item.name}" wirklich löschen? Historie bleibt (mit Hinweis).`);
      if (!ok) return;
      state.items = state.items.filter(i => i.id !== id);
      persist();
      hydrateUI();
      toast("Artikel gelöscht.");
    }
  }

  function deleteMove(id){
    const ok = confirm("Diese Buchung entfernen? Achtung: Bestand wird NICHT automatisch zurückgerechnet.");
    if (!ok) return;
    state.moves = state.moves.filter(m => m.id !== id);
    persist();
    hydrateUI();
  }

  function openEdit(item){
    $("editId").value = item.id;
    $("editSku").value = item.sku;
    $("editName").value = item.name;
    $("editCategory").value = item.category || "";
    $("editSupplier").value = item.supplier || "";
    $("editCost").value = String(item.cost ?? 0);
    $("editPrice").value = String(item.price ?? 0);
    $("editStock").value = String(item.stock ?? 0);

    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(){
    modal.setAttribute("aria-hidden", "true");
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { items: [], moves: [] };
      const parsed = JSON.parse(raw);
      // minimal validation
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        moves: Array.isArray(parsed.moves) ? parsed.moves : []
      };
    }catch{
      return { items: [], moves: [] };
    }
  }

  function persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function exportCSV(){
    const lines = [];
    lines.push("SECTION,items");
    lines.push("id,sku,name,category,supplier,cost,price,stock");
    state.items.forEach(i => {
      lines.push([
        i.id, csv(i.sku), csv(i.name), csv(i.category||""), csv(i.supplier||""),
        num(i.cost), num(i.price), int(i.stock)
      ].join(","));
    });

    lines.push("");
    lines.push("SECTION,moves");
    lines.push("id,ts,type,itemId,qty,unit,note");
    state.moves.forEach(m => {
      lines.push([
        m.id, m.ts, m.type, m.itemId, int(m.qty), num(m.unit), csv(m.note||"")
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stockpilot_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCSV(e){
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    const ok = confirm("Import überschreibt NICHT automatisch. Ich mische Daten ein (IDs bleiben). Fortfahren?");
    if(!ok){ e.target.value=""; return; }

    const rows = parseCSV(text);

    let section = "";
    for (const row of rows){
      if(row[0] === "SECTION"){
        section = row[1] || "";
        continue;
      }
      if(!section) continue;
      if(row[0] === "id") continue; // header

      if(section === "items"){
        const [id, sku, name, category, supplier, cost, price, stock] = row;
        if(!id || !sku || !name) continue;
        // skip if already exists by id
        if(state.items.some(x => x.id === id)) continue;
        // also prevent sku collisions
        if(existsSku(sku)) continue;

        state.items.push({
          id,
          sku,
          name,
          category: category || "",
          supplier: supplier || "",
          cost: toNum(cost),
          price: toNum(price),
          stock: toInt(stock)
        });
      }

      if(section === "moves"){
        const [id, ts, type, itemId, qty, unit, note] = row;
        if(!id || !ts || !type || !itemId) continue;
        if(state.moves.some(x => x.id === id)) continue;
        state.moves.push({
          id,
          ts: Number(ts),
          type,
          itemId,
          qty: toInt(qty),
          unit: toNum(unit),
          note: note || ""
        });
      }
    }

    state.moves.sort((a,b) => b.ts - a.ts);

    persist();
    hydrateUI();
    toast("Import abgeschlossen.");
    e.target.value = "";
  }
  
  function existsSku(sku){
    return state.items.some(i => i.sku.toLowerCase() === sku.toLowerCase());
  }

  function toNum(v){
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function toInt(v){
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
  }
  function num(v){ return Number.isFinite(v) ? String(v) : String(toNum(v)); }
  function int(v){ return String(toInt(v)); }

  function typeLabel(t){
    if(t === "purchase") return "Einkauf";
    if(t === "sale") return "Verkauf";
    return "Korrektur";
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function csv(value){
    const s = String(value ?? "");
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function parseCSV(text){
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;

    for(let i=0;i<text.length;i++){
      const ch = text[i];
      const next = text[i+1];

      if(inQ){
        if(ch === '"' && next === '"'){ cur += '"'; i++; continue; }
        if(ch === '"'){ inQ = false; continue; }
        cur += ch; continue;
      } else {
        if(ch === '"'){ inQ = true; continue; }
        if(ch === ","){ row.push(cur); cur=""; continue; }
        if(ch === "\n"){
          row.push(cur); rows.push(row);
          row=[]; cur=""; continue;
        }
        if(ch === "\r") continue;
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
    return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ""));
  }


  let toastTimer = null;
  function toast(msg){
    clearTimeout(toastTimer);
    let el = document.getElementById("toast");
    if(!el){
      el = document.createElement("div");
      el.id = "toast";
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "18px";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "14px";
      el.style.background = "rgba(0,0,0,.60)";
      el.style.border = "1px solid rgba(255,255,255,.12)";
      el.style.color = "white";
      el.style.zIndex = "999";
      el.style.backdropFilter = "blur(8px)";
      el.style.boxShadow = "0 18px 60px rgba(0,0,0,.35)";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 2200);
  }
})();
