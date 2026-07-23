#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
  process.env.TLAW_CONSTITUTION_URL ||
  "https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80/print";
const SOURCE_ID = "254k-96-vr";
const ACT_ID = "ua-constitution-254k-96-vr";
const REVISION_ID = "ua-constitution-254k-96-vr-current";
const OUT = process.argv[2] || "build/tlaw/constitution-import.sql";

const sha = (value) =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");


function encodingDamageScore(value) {
  const replacement = (value.match(/\uFFFD/g) || []).length;
  const nul = (value.match(/\u0000/g) || []).length;
  const mojibake = (
    value.match(/(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]?|â(?:€|„|”|€™|€“|€”|€¦)|Ð[\u0080-\u00BF]|Ñ[\u0080-\u00BF])/g) || []
  ).length;
  const ukrainian = (
    value.match(/[А-Яа-яІіЇїЄєҐґ]/g) || []
  ).length;
  const legalMarkers = [
    "КОНСТИТУЦІЯ УКРАЇНИ",
    "Конституція України",
    "Стаття 1",
    "Верховна Рада України"
  ].filter((marker) => value.includes(marker)).length;

  return replacement * 100000 +
    nul * 100000 +
    mojibake * 1000 -
    legalMarkers * 100000 -
    Math.min(ukrainian, 20000);
}

function decodeOfficialSource(bytes, contentType = "") {
  const declared =
    contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase();

  const labels = [
    declared,
    "utf-8",
    "windows-1251",
    "koi8-u"
  ].filter(Boolean);

  const candidates = [];
  for (const label of [...new Set(labels)]) {
    try {
      const value = new TextDecoder(label, { fatal: false }).decode(bytes);
      candidates.push({
        label,
        value,
        score: encodingDamageScore(value)
      });
    } catch {
      // Unsupported decoder labels are ignored.
    }
  }

  if (!candidates.length) {
    throw new Error("No supported decoder is available for the official source");
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  let value = best.value
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .normalize("NFC");

  // Repair the common case where valid UTF-8 was interpreted as Latin-1.
  if (/(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]?|Ð[\u0080-\u00BF]|Ñ[\u0080-\u00BF]){3,}/.test(value)) {
    try {
      const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
      const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (encodingDamageScore(repaired) < encodingDamageScore(value)) {
        value = repaired.normalize("NFC");
      }
    } catch {
      // Keep the best raw decoding when reinterpretation is not valid UTF-8.
    }
  }

  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  const suspiciousCount = (
    value.match(/(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]?|â(?:€|„|”|€™|€“|€”|€¦)|Ð[\u0080-\u00BF]|Ñ[\u0080-\u00BF])/g) || []
  ).length;

  if (replacementCount > 0) {
    throw new Error(
      `Encoding integrity check failed: ${replacementCount} replacement characters remain`
    );
  }
  if (suspiciousCount > 5) {
    throw new Error(
      `Encoding integrity check failed: ${suspiciousCount} mojibake fragments remain`
    );
  }

  console.log(
    `Detected source encoding: ${best.label}; encoding score: ${best.score}`
  );
  return value;
}


function repairIsolatedReplacementCharacters(value) {
  let repaired = 0;
  const output = [...value].map((char, index, chars) => {
    if (char !== "\uFFFD") return char;

    const previous = chars[index - 1] ?? "";
    const next = chars[index + 1] ?? "";
    const touchesLetterOrNumber =
      /[\p{L}\p{N}]/u.test(previous) || /[\p{L}\p{N}]/u.test(next);

    if (touchesLetterOrNumber) {
      throw new Error(
        `Unsafe encoding damage: replacement character touches legal text at offset ${index}`
      );
    }

    repaired += 1;
    return "";
  }).join("");

  if (repaired > 0) {
    console.log(`Repaired isolated replacement characters: ${repaired}`);
  }
  return output;
}

function assertCleanUnicode(value, label) {
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  const nulCount = (value.match(/\u0000/g) || []).length;
  const mojibakeCount = (
    value.match(/(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]?|â(?:€|„|”|€™|€“|€”|€¦)|Ð[\u0080-\u00BF]|Ñ[\u0080-\u00BF])/g) || []
  ).length;

  if (replacementCount || nulCount || mojibakeCount > 5) {
    throw new Error(
      `${label} failed Unicode audit: replacement=${replacementCount}, ` +
      `nul=${nulCount}, mojibake=${mojibakeCount}`
    );
  }
}

function decodeEntities(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
    plus: "+", minus: "−", hellip: "…", copy: "©", sect: "§"
  };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

function htmlToText(html) {
  let value = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  value = decodeEntities(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const starts = [
    value.indexOf("КОНСТИТУЦІЯ УКРАЇНИ"),
    value.indexOf("Конституція України")
  ].filter((n) => n >= 0);
  if (!starts.length) throw new Error("Official document text marker was not found");
  value = value.slice(Math.min(...starts));

  const footerMarkers = [
    "\nКод для вставки:",
    "\nПосилання згідно ДСТУ",
    "\nВесь контент доступний",
    "\n© Верховна Рада України"
  ];
  for (const marker of footerMarkers) {
    const at = value.indexOf(marker);
    if (at > 5000) value = value.slice(0, at);
  }
  return value.trim();
}

function normalize(value) {
  return value.toLocaleLowerCase("uk-UA")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function unitId(pathValue, text) {
  return `ua-constitution-${sha(`${pathValue}\n${text}`).slice(0, 24)}`;
}

function parseConstitution(text) {
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const units = [];
  let section = null;
  let article = null;
  let sort = 0;
  let preamble = [];

  const push = (u) => {
    sort += 1;
    units.push({ ...u, sort_order: sort });
    return units[units.length - 1];
  };

  const flushPreamble = () => {
    const body = preamble.join("\n").trim();
    if (!body) return;
    const p = "preamble";
    push({
      id: unitId(p, body), parent_id: null, unit_type: "preamble",
      unit_number: null, heading: "Преамбула", text_plain: body,
      normalized_text: normalize(body), depth: 0, path: p,
      source_anchor: null, content_hash: sha(body)
    });
    preamble = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sectionMatch = line.match(/^Розділ\s+([IVXLCDM]+)\b[.\s-]*(.*)$/iu);
    if (sectionMatch) {
      flushPreamble();
      const number = sectionMatch[1].toUpperCase();
      let heading = sectionMatch[2].trim();
      if (!heading && lines[i + 1] && !/^Стаття\s+/iu.test(lines[i + 1])) {
        heading = lines[++i];
      }
      const p = `section/${number}`;
      section = push({
        id: unitId(p, heading), parent_id: null, unit_type: "section",
        unit_number: number, heading, text_plain: "",
        normalized_text: normalize(`${number} ${heading}`), depth: 0, path: p,
        source_anchor: null, content_hash: sha(`${number}\n${heading}`)
      });
      article = null;
      continue;
    }

    const articleMatch = line.match(/^Стаття\s+(\d+(?:-\d+)?)\s*[.\-–—]?\s*(.*)$/iu);
    if (articleMatch) {
      flushPreamble();
      const number = articleMatch[1];
      const firstText = articleMatch[2].trim();
      const p = `${section?.path ?? "root"}/article/${number}`;
      article = push({
        id: unitId(p, firstText), parent_id: section?.id ?? null,
        unit_type: "article", unit_number: number,
        heading: `Стаття ${number}`, text_plain: firstText,
        normalized_text: normalize(firstText), depth: section ? 1 : 0, path: p,
        source_anchor: `st${number}`, content_hash: sha(firstText)
      });
      continue;
    }

    if (!article) {
      preamble.push(line);
      continue;
    }

    const pointMatch = line.match(/^(\d+)(?:[-–—](\d+))?\)\s*(.*)$/u);
    const type = pointMatch ? "point" : "part";
    const number = pointMatch
      ? (pointMatch[2] ? `${pointMatch[1]}-${pointMatch[2]}` : pointMatch[1])
      : String(units.filter((u) => u.parent_id === article.id && u.unit_type === "part").length + 1);
    const body = pointMatch ? pointMatch[3].trim() : line;
    const p = `${article.path}/${type}/${number}`;
    push({
      id: unitId(p, body), parent_id: article.id, unit_type: type,
      unit_number: number, heading: null, text_plain: body,
      normalized_text: normalize(body), depth: article.depth + 1, path: p,
      source_anchor: null, content_hash: sha(body)
    });
  }

  flushPreamble();
  const articles = units.filter((u) => u.unit_type === "article").length;
  if (articles < 150) {
    throw new Error(`Parser integrity check failed: only ${articles} articles detected`);
  }
  return units;
}

async function main() {
  console.log(`Fetching official source: ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "Rodavarion-TLAW/2.2 (+https://rodavarion.org/tlaw/)",
      "accept-language": "uk-UA,uk;q=0.9"
    },
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`);
  const sourceBytes = new Uint8Array(await response.arrayBuffer());
  const html = decodeOfficialSource(
    sourceBytes,
    response.headers.get("content-type") || ""
  );
  assertCleanUnicode(html, "Official HTML");
  if (/data-load=["'][^"']+\.frame["']/i.test(html) && !/Стаття\s+1\s*[.\-–—]/iu.test(html)) {
    throw new Error("Official site returned the shell page instead of printable document text");
  }
  const text = htmlToText(html).normalize("NFC");
  assertCleanUnicode(text, "Normalized legal text");
  const sourceHash = sha(text);
  let units = parseConstitution(text);

  const pathSeen = new Map();
  let repairedPaths = 0;
  units = units.map((unit) => {
    const occurrence = (pathSeen.get(unit.path) ?? 0) + 1;
    pathSeen.set(unit.path, occurrence);
    if (occurrence === 1) return unit;
    repairedPaths += 1;
    return {
      ...unit,
      path: `${unit.path}/occurrence-${occurrence}-${unit.content_hash.slice(0, 12)}`
    };
  });

  const idGroups = new Map();
  for (const unit of units) {
    const group = idGroups.get(unit.id) ?? [];
    group.push(unit);
    idGroups.set(unit.id, group);
  }
  const referencedParents = new Set(
    units.map((unit) => unit.parent_id).filter(Boolean)
  );
  for (const [id, group] of idGroups) {
    if (group.length > 1 && referencedParents.has(id)) {
      throw new Error(`Ambiguous duplicated parent unit id ${id}`);
    }
  }

  const idSeen = new Map();
  let repairedIds = 0;
  units = units.map((unit) => {
    const occurrence = (idSeen.get(unit.id) ?? 0) + 1;
    idSeen.set(unit.id, occurrence);
    if (occurrence === 1) return unit;
    repairedIds += 1;
    return {
      ...unit,
      id: unitId(`${unit.path}/id-${occurrence}`, unit.text_plain)
    };
  });

  if (new Set(units.map((u) => u.path)).size !== units.length) {
    throw new Error("Internal integrity failure: legal unit paths are not unique");
  }
  if (new Set(units.map((u) => u.id)).size !== units.length) {
    throw new Error("Internal integrity failure: legal unit IDs are not unique");
  }

  for (const unit of units) {
    assertCleanUnicode(unit.text_plain || "", `Legal unit ${unit.id}`);
    assertCleanUnicode(unit.heading || "", `Legal unit heading ${unit.id}`);
  }

  const now = new Date().toISOString();
  const importId = `constitution-${sourceHash.slice(0, 24)}`;

  const statements = [
    "PRAGMA foreign_keys = ON;",
    `INSERT INTO legal_import_runs
      (id, source_system, source_url, source_identifier, source_revision, source_hash, status, started_at)
     VALUES (${sql(importId)}, 'Verkhovna Rada of Ukraine', ${sql(SOURCE_URL)},
             ${sql(SOURCE_ID)}, 'current', ${sql(sourceHash)}, 'started', ${sql(now)})
     ON CONFLICT(id) DO UPDATE SET status='started', message=NULL, started_at=${sql(now)}, finished_at=NULL;`,
    `INSERT INTO legal_acts
      (id, act_type, title, short_title, act_number, issuer, status, adopted_on,
       effective_from, official_url, language, current_revision_id, updated_at)
     VALUES (
       ${sql(ACT_ID)}, 'constitution', 'Конституція України', 'Конституція України',
       '254к/96-ВР', 'Верховна Рада України', 'effective', '1996-06-28',
       '1996-06-28', ${sql(SOURCE_URL)}, 'uk', ${sql(REVISION_ID)}, CURRENT_TIMESTAMP
     )
     ON CONFLICT(id) DO UPDATE SET
       status='effective', official_url=excluded.official_url,
       current_revision_id=excluded.current_revision_id, updated_at=CURRENT_TIMESTAMP;`,
    `INSERT INTO act_revisions
      (id, act_id, revision_number, valid_from, source_url, source_hash, text_plain)
     VALUES (${sql(REVISION_ID)}, ${sql(ACT_ID)}, 1, '2020-01-01',
             ${sql(SOURCE_URL)}, ${sql(sourceHash)},
             'Structured official text is stored in legal_units')
     ON CONFLICT(id) DO UPDATE SET
       source_url=excluded.source_url, source_hash=excluded.source_hash,
       text_plain=excluded.text_plain;`,
    `DELETE FROM legal_units WHERE revision_id=${sql(REVISION_ID)};`
  ];

  for (const u of units) {
    statements.push(`INSERT INTO legal_units
      (id, act_id, revision_id, parent_id, unit_type, unit_number, heading,
       text_plain, normalized_text, sort_order, depth, path, source_anchor, content_hash)
      VALUES (
        ${sql(u.id)}, ${sql(ACT_ID)}, ${sql(REVISION_ID)}, ${sql(u.parent_id)},
        ${sql(u.unit_type)}, ${sql(u.unit_number)}, ${sql(u.heading)},
        ${sql(u.text_plain)}, ${sql(u.normalized_text)}, ${u.sort_order}, ${u.depth},
        ${sql(u.path)}, ${sql(u.source_anchor)}, ${sql(u.content_hash)}
      );`);
  }

  statements.push(
    `UPDATE legal_import_runs SET status='completed', units_imported=${units.length},
       finished_at=CURRENT_TIMESTAMP WHERE id=${sql(importId)};`,
    `INSERT INTO system_metadata (key, value, updated_at)
     VALUES ('constitution_source_hash', ${sql(sourceHash)}, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;`
  );

  const maxStatementBytes = Math.max(
    ...statements.map((statement) => Buffer.byteLength(statement, "utf8"))
  );
  if (maxStatementBytes > 90000) {
    throw new Error(`Generated SQL statement is too large: ${maxStatementBytes} bytes`);
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, statements.join("\n\n") + "\n", "utf8");
  console.log(`Generated ${OUT}`);
  console.log(`Official text SHA-256: ${sourceHash}`);
  console.log(`Structured units: ${units.length}`);
  console.log(`Articles: ${units.filter((u) => u.unit_type === "article").length}`);
  console.log(`Repaired duplicate paths: ${repairedPaths}`);
  console.log(`Repaired duplicate IDs: ${repairedIds}`);
}

main().catch((error) => {
  console.error(`IMPORT GENERATION FAILED: ${error.message}`);
  process.exit(1);
});
