(() => {
  "use strict";

  const API = "/api/tlaw/concepts/resolve";
  const MAX_HIGHLIGHTS = 120;
  const state = {
    catalog: [],
    pattern: null,
    panel: null,
    title: null,
    status: null,
    units: null,
    relations: null
  };

  const relationLabels = {
    defines: "Визначає",
    protects: "Охороняє",
    prohibits: "Забороняє",
    limits: "Обмежує",
    implements: "Реалізує",
    references: "Пов’язано з",
    interprets: "Тлумачить",
    supports: "Підтримує",
    conflicts: "Потенційний конфлікт",
    related: "Пов’язана норма",
    conflicts_with: "Суперечить",
    supported_by: "Підтримується",
    overrides: "Має пріоритет над",
    interpreted_by: "Тлумачиться",
    related_to: "Пов’язане поняття",
    extends: "Розширює"
  };

  const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function injectStyles() {
    if (document.getElementById("tlaw-knowledge-graph-style")) return;
    const style = document.createElement("style");
    style.id = "tlaw-knowledge-graph-style";
    style.textContent = `
      .tlaw-concept-trigger {
        appearance:none;font:inherit;color:inherit;
        background:color-mix(in srgb,currentColor 12%,transparent);
        border:0;border-bottom:1px dashed currentColor;border-radius:.24em;
        padding:0 .08em;cursor:pointer
      }
      .tlaw-concept-trigger:hover,
      .tlaw-concept-trigger:focus-visible,
      .tlaw-concept-trigger[aria-pressed=true] {
        background:color-mix(in srgb,currentColor 24%,transparent);outline:none
      }
      .tlaw-graph-panel {
        position:fixed;z-index:2147483000;top:1rem;right:1rem;
        width:min(480px,calc(100vw - 2rem));max-height:calc(100vh - 2rem);
        overflow:auto;color:inherit;
        background:color-mix(in srgb,Canvas 95%,transparent);
        border:1px solid color-mix(in srgb,currentColor 26%,transparent);
        border-radius:18px;box-shadow:0 22px 80px rgba(0,0,0,.42);
        backdrop-filter:blur(18px);padding:1rem
      }
      .tlaw-graph-panel[hidden]{display:none!important}
      .tlaw-graph-head{display:flex;justify-content:space-between;gap:1rem;align-items:start}
      .tlaw-graph-head h2{margin:.15rem 0 0;font-size:1.12rem}
      .tlaw-graph-kicker{font-size:.72rem;letter-spacing:.08em;opacity:.62}
      .tlaw-graph-close{font:inherit;color:inherit;background:transparent;
        border:1px solid color-mix(in srgb,currentColor 25%,transparent);
        border-radius:8px;cursor:pointer}
      .tlaw-graph-status{margin:.7rem 0;opacity:.72;font-size:.86rem}
      .tlaw-graph-section{margin-top:1rem}
      .tlaw-graph-section h3{margin:0 0 .55rem;font-size:.82rem;letter-spacing:.04em;opacity:.7}
      .tlaw-graph-list{display:grid;gap:.65rem}
      .tlaw-graph-card{display:block;color:inherit;text-decoration:none;
        border:1px solid color-mix(in srgb,currentColor 18%,transparent);
        border-radius:12px;padding:.72rem;background:color-mix(in srgb,currentColor 5%,transparent)}
      .tlaw-graph-card:hover,.tlaw-graph-card:focus-visible{border-color:currentColor;outline:none}
      .tlaw-graph-card strong,.tlaw-graph-card span{display:block}
      .tlaw-graph-card span{margin-top:.3rem;opacity:.74;font-size:.84rem}
      .tlaw-graph-badge{display:inline-block!important;width:max-content;margin:0 0 .35rem!important;
        padding:.16rem .42rem;border:1px solid color-mix(in srgb,currentColor 24%,transparent);
        border-radius:999px;font-size:.7rem!important;opacity:.82!important}
      .tlaw-graph-warning{border-style:dashed}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (state.panel) return;
    const panel = document.createElement("aside");
    panel.className = "tlaw-graph-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Вікно конфліктів і правових зв’язків");
    panel.innerHTML = `
      <div class="tlaw-graph-head">
        <div>
          <div class="tlaw-graph-kicker">ВІКНО КОНФЛІКТІВ І ЗВ’ЯЗКІВ</div>
          <h2></h2>
        </div>
        <button class="tlaw-graph-close" type="button" aria-label="Закрити">×</button>
      </div>
      <div class="tlaw-graph-status"></div>
      <section class="tlaw-graph-section">
        <h3>ПОВ’ЯЗАНІ НОРМИ</h3>
        <div class="tlaw-graph-list" data-role="units"></div>
      </section>
      <section class="tlaw-graph-section">
        <h3>ЗВ’ЯЗКИ МІЖ ПОНЯТТЯМИ</h3>
        <div class="tlaw-graph-list" data-role="relations"></div>
      </section>
    `;
    panel.querySelector(".tlaw-graph-close").addEventListener("click", closePanel);
    document.body.appendChild(panel);
    state.panel = panel;
    state.title = panel.querySelector("h2");
    state.status = panel.querySelector(".tlaw-graph-status");
    state.units = panel.querySelector('[data-role="units"]');
    state.relations = panel.querySelector('[data-role="relations"]');
  }

  function closePanel() {
    state.panel.hidden = true;
    document.querySelectorAll(".tlaw-concept-trigger[aria-pressed=true]")
      .forEach((node) => node.setAttribute("aria-pressed", "false"));
  }

  async function loadCatalog() {
    const response = await fetch(`${API}?catalog=1`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const payload = await response.json();
    state.catalog = Array.isArray(payload.data) ? payload.data : [];
    const aliases = [...new Set(state.catalog.map((item) => item.alias))]
      .filter((alias) => alias.length >= 4)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    state.pattern = aliases.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${aliases.join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu")
      : null;
  }

  function eligible(node) {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue?.trim()) return false;
    return !parent.closest(
      "script,style,textarea,input,button,a,code,pre,.tlaw-graph-panel,.tlaw-concept-trigger"
    );
  }

  function highlight(root = document.body) {
    if (!root || !state.pattern) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode() && nodes.length < MAX_HIGHLIGHTS * 5) {
      if (eligible(walker.currentNode)) nodes.push(walker.currentNode);
    }

    let count = 0;
    for (const node of nodes) {
      if (count >= MAX_HIGHLIGHTS) break;
      const text = node.nodeValue;
      state.pattern.lastIndex = 0;
      let match;
      let cursor = 0;
      let changed = false;
      const fragment = document.createDocumentFragment();

      while ((match = state.pattern.exec(text)) && count < MAX_HIGHLIGHTS) {
        const prefix = match[1] || "";
        const term = match[2];
        const start = match.index + prefix.length;
        fragment.append(text.slice(cursor, start));

        const button = document.createElement("button");
        button.type = "button";
        button.className = "tlaw-concept-trigger";
        button.textContent = term;
        button.setAttribute("aria-pressed", "false");
        button.title = "Показати правові зв’язки";
        button.addEventListener("click", () => resolveConcept(term, button));
        fragment.append(button);

        cursor = start + term.length;
        changed = true;
        count += 1;
      }

      if (changed) {
        fragment.append(text.slice(cursor));
        node.replaceWith(fragment);
      }
    }
  }

  function unitCard(unit) {
    const link = document.createElement("a");
    link.className = "tlaw-graph-card";
    if (unit.relationType === "conflicts" && unit.reviewStatus !== "reviewed") {
      link.classList.add("tlaw-graph-warning");
    }
    link.href = `/tlaw/?act=${encodeURIComponent(unit.actId)}&unit=${encodeURIComponent(unit.unitId)}`;
    const heading = unit.heading ||
      `${unit.unitType || "Норма"} ${unit.unitNumber || ""}`.trim();
    const preview = String(unit.textPlain || "").replace(/\s+/g, " ").trim().slice(0, 180);
    const badge = relationLabels[unit.relationType] || unit.relationType;
    const review = unit.reviewStatus === "candidate" ? " · потребує перевірки" : "";
    link.innerHTML = `
      <span class="tlaw-graph-badge">${badge}${review}</span>
      <strong>${unit.actTitle}: ${heading}</strong>
      <span>${preview}${String(unit.textPlain || "").length > 180 ? "…" : ""}</span>
    `;
    return link;
  }

  function relationCard(relation) {
    const card = document.createElement("div");
    card.className = "tlaw-graph-card";
    const badge = relationLabels[relation.relationType] || relation.relationType;
    const review = relation.reviewStatus === "candidate" ? " · потребує перевірки" : "";
    card.innerHTML = `
      <span class="tlaw-graph-badge">${badge}${review}</span>
      <strong>${relation.canonicalLabel}</strong>
      <span>${relation.note || "Семантичний зв’язок між правовими поняттями."}</span>
    `;
    return card;
  }

  function render(payload) {
    state.units.replaceChildren();
    state.relations.replaceChildren();

    if (!payload?.data) {
      state.title.textContent = "Поняття не знайдено";
      state.status.textContent = "Для цього слова ще немає підтвердженого вузла у правовому графі.";
      return;
    }

    const { concept, units = [], relations = [] } = payload.data;
    state.title.textContent = concept.canonicalLabel;
    state.status.textContent =
      `${concept.description || ""} Пов’язаних норм: ${units.length}; зв’язків понять: ${relations.length}.`;

    if (!units.length) {
      state.units.textContent = "Пов’язані норми ще не додані.";
    } else {
      units.forEach((unit) => state.units.appendChild(unitCard(unit)));
    }

    if (!relations.length) {
      state.relations.textContent = "Зв’язки з іншими поняттями ще не додані.";
    } else {
      relations.forEach((relation) => state.relations.appendChild(relationCard(relation)));
    }
  }

  async function resolveConcept(term, trigger) {
    ensurePanel();
    document.querySelectorAll(".tlaw-concept-trigger[aria-pressed=true]")
      .forEach((node) => node.setAttribute("aria-pressed", "false"));
    trigger.setAttribute("aria-pressed", "true");
    state.panel.hidden = false;
    state.title.textContent = term;
    state.status.textContent = "Завантажую правовий граф…";
    state.units.replaceChildren();
    state.relations.replaceChildren();

    try {
      const response = await fetch(`${API}?q=${encodeURIComponent(term)}`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`Resolve HTTP ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.error("TLAW legal knowledge graph failure", error);
      state.status.textContent = "Не вдалося завантажити правові зв’язки.";
    }
  }

  async function boot() {
    injectStyles();
    ensurePanel();
    try {
      await loadCatalog();
      highlight(document.body);
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) highlight(node);
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      console.error("TLAW concept catalog failure", error);
    }

    window.TLAW_LEGAL_KNOWLEDGE_GRAPH = Object.freeze({
      version: "1.0.0",
      refresh: () => highlight(document.body),
      resolve: (term) => fetch(`${API}?q=${encodeURIComponent(term)}`).then((r) => r.json())
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
