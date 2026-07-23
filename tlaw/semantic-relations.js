(() => {
  "use strict";

  const CONFIG = {
    apiBase: "/api/tlaw",
    minWordLength: 5,
    maxHighlights: 80,
    relations: [
      {
        id: "intentional-killing",
        labels: ["вбивство", "умисне вбивство", "позбавлення життя"],
        queries: ["умисне вбивство", "право на життя"],
        title: "Вбивство та право на життя"
      },
      {
        id: "human-dignity",
        labels: ["гідність", "приниження гідності"],
        queries: ["гідність людини", "катування"],
        title: "Людська гідність"
      },
      {
        id: "property",
        labels: ["власність", "майно", "право власності"],
        queries: ["право власності", "протиправне позбавлення власності"],
        title: "Право власності"
      }
    ]
  };

  const state = { panel: null, list: null, title: null, status: null };

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function injectStyles() {
    if (document.getElementById("tlaw-semantic-relations-style")) return;
    const style = document.createElement("style");
    style.id = "tlaw-semantic-relations-style";
    style.textContent = `
      .tlaw-semantic-trigger {
        appearance: none;
        font: inherit;
        color: inherit;
        background: color-mix(in srgb, currentColor 13%, transparent);
        border: 0;
        border-bottom: 1px dashed currentColor;
        border-radius: .24em;
        padding: 0 .08em;
        cursor: pointer;
      }
      .tlaw-semantic-trigger:hover,
      .tlaw-semantic-trigger:focus-visible,
      .tlaw-semantic-trigger[aria-pressed="true"] {
        background: color-mix(in srgb, currentColor 22%, transparent);
        outline: none;
      }
      .tlaw-relations-panel {
        position: fixed;
        z-index: 2147483000;
        top: 1rem;
        right: 1rem;
        width: min(420px, calc(100vw - 2rem));
        max-height: calc(100vh - 2rem);
        overflow: auto;
        color: inherit;
        background: color-mix(in srgb, Canvas 94%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
        border-radius: 16px;
        box-shadow: 0 20px 70px rgba(0,0,0,.35);
        backdrop-filter: blur(18px);
        padding: 1rem;
      }
      .tlaw-relations-panel[hidden] { display: none !important; }
      .tlaw-relations-head {
        display: flex;
        gap: .75rem;
        align-items: start;
        justify-content: space-between;
      }
      .tlaw-relations-head h2 { margin: 0; font-size: 1rem; }
      .tlaw-relations-close {
        font: inherit;
        color: inherit;
        background: transparent;
        border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
        border-radius: 8px;
        cursor: pointer;
      }
      .tlaw-relations-status { margin: .75rem 0; opacity: .72; font-size: .88rem; }
      .tlaw-relations-list { display: grid; gap: .7rem; }
      .tlaw-related-card {
        display: block;
        color: inherit;
        text-decoration: none;
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        border-radius: 12px;
        padding: .75rem;
        background: color-mix(in srgb, currentColor 5%, transparent);
      }
      .tlaw-related-card:hover,
      .tlaw-related-card:focus-visible { border-color: currentColor; outline: none; }
      .tlaw-related-card strong,
      .tlaw-related-card span { display: block; }
      .tlaw-related-card span { margin-top: .35rem; opacity: .76; font-size: .86rem; }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (state.panel) return;
    const panel = document.createElement("aside");
    panel.className = "tlaw-relations-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Пов’язані правові норми");
    panel.innerHTML = `
      <div class="tlaw-relations-head">
        <div>
          <div style="opacity:.65;font-size:.78rem">ВІКНО КОНФЛІКТІВ І ЗВ’ЯЗКІВ</div>
          <h2></h2>
        </div>
        <button class="tlaw-relations-close" type="button" aria-label="Закрити">×</button>
      </div>
      <div class="tlaw-relations-status"></div>
      <div class="tlaw-relations-list"></div>
    `;
    panel.querySelector(".tlaw-relations-close").addEventListener("click", () => {
      panel.hidden = true;
      document.querySelectorAll(".tlaw-semantic-trigger[aria-pressed=true]")
        .forEach((node) => node.setAttribute("aria-pressed", "false"));
    });
    document.body.appendChild(panel);
    state.panel = panel;
    state.title = panel.querySelector("h2");
    state.status = panel.querySelector(".tlaw-relations-status");
    state.list = panel.querySelector(".tlaw-relations-list");
  }

  function normalizeResults(payload) {
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows.map((row) => ({
      id: row.id,
      actId: row.actId,
      unitType: row.unitType,
      unitNumber: row.unitNumber,
      heading: row.heading || `${row.unitType || "Норма"} ${row.unitNumber || ""}`.trim(),
      text: row.textPlain || ""
    }));
  }

  async function fetchRelationResults(relation) {
    const all = [];
    const seen = new Set();
    for (const query of relation.queries) {
      const response = await fetch(
        `${CONFIG.apiBase}/search?q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) continue;
      const payload = await response.json();
      for (const row of normalizeResults(payload)) {
        if (!row.id || seen.has(row.id)) continue;
        seen.add(row.id);
        all.push(row);
      }
    }
    return all.slice(0, 24);
  }

  function renderResults(relation, rows) {
    state.title.textContent = relation.title;
    state.list.replaceChildren();
    if (!rows.length) {
      state.status.textContent = "Пов’язаних норм поки не знайдено.";
      return;
    }
    state.status.textContent = `Знайдено пов’язаних норм: ${rows.length}.`;
    for (const row of rows) {
      const link = document.createElement("a");
      link.className = "tlaw-related-card";
      link.href = `/tlaw/?act=${encodeURIComponent(row.actId || "")}&unit=${encodeURIComponent(row.id)}`;
      const preview = row.text.replace(/\s+/g, " ").trim().slice(0, 170);
      link.innerHTML = `<strong>${row.heading}</strong><span>${preview}${row.text.length > 170 ? "…" : ""}</span>`;
      state.list.appendChild(link);
    }
  }

  async function openRelation(relation, trigger) {
    ensurePanel();
    document.querySelectorAll(".tlaw-semantic-trigger[aria-pressed=true]")
      .forEach((node) => node.setAttribute("aria-pressed", "false"));
    trigger.setAttribute("aria-pressed", "true");
    state.panel.hidden = false;
    state.title.textContent = relation.title;
    state.status.textContent = "Шукаю пов’язані статті…";
    state.list.replaceChildren();
    try {
      renderResults(relation, await fetchRelationResults(relation));
    } catch (error) {
      console.error("TLAW semantic relation lookup failed", error);
      state.status.textContent = "Не вдалося завантажити пов’язані норми.";
    }
  }

  function relationForText(text) {
    const lower = text.toLocaleLowerCase("uk-UA");
    return CONFIG.relations.find((relation) =>
      relation.labels.some((label) => lower === label.toLocaleLowerCase("uk-UA"))
    );
  }

  function buildPattern() {
    const labels = CONFIG.relations.flatMap((item) => item.labels)
      .filter((label) => label.length >= CONFIG.minWordLength)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    return new RegExp(`(^|[^\\p{L}\\p{N}_])(${labels.join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  }

  function eligibleTextNode(node) {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue?.trim()) return false;
    return !parent.closest("script,style,textarea,input,button,a,code,pre,.tlaw-relations-panel,.tlaw-semantic-trigger");
  }

  function highlightRoot(root = document.body) {
    if (!root) return;
    const pattern = buildPattern();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode() && nodes.length < CONFIG.maxHighlights * 5) {
      if (eligibleTextNode(walker.currentNode)) nodes.push(walker.currentNode);
    }

    let highlights = 0;
    for (const node of nodes) {
      if (highlights >= CONFIG.maxHighlights) break;
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      let match;
      let cursor = 0;
      const fragment = document.createDocumentFragment();
      let changed = false;

      while ((match = pattern.exec(text)) && highlights < CONFIG.maxHighlights) {
        const prefix = match[1] || "";
        const term = match[2];
        const termStart = match.index + prefix.length;
        fragment.append(text.slice(cursor, termStart));
        const relation = relationForText(term);
        if (!relation) continue;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "tlaw-semantic-trigger";
        button.textContent = term;
        button.setAttribute("aria-pressed", "false");
        button.title = `Показати пов’язані норми: ${relation.title}`;
        button.addEventListener("click", () => openRelation(relation, button));
        fragment.append(button);

        cursor = termStart + term.length;
        highlights += 1;
        changed = true;
      }

      if (changed) {
        fragment.append(text.slice(cursor));
        node.replaceWith(fragment);
      }
    }
  }

  function boot() {
    injectStyles();
    ensurePanel();
    highlightRoot(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) highlightRoot(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.TLAW_SEMANTIC_RELATIONS = Object.freeze({
      version: "0.1.0",
      refresh: () => highlightRoot(document.body),
      relations: CONFIG.relations.map(({ id, title, labels }) => ({ id, title, labels }))
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
