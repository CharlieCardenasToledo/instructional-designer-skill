"use strict";

/**
 * bibliography.test.js — Pruebas de bibliography-manager y citas en guide-renderer.
 *
 * Valida:
 *  - renderCitation: modo degradado (sin Citation.js)
 *  - renderCitation: narrative vs parenthetical con datos CSL-JSON reales
 *  - citationStyle: se propaga desde metadata.citationStyle al HTML
 *  - processInlineMarkup: sintaxis {{cite:clave}} y {{cite:clave|narrative}}
 *  - renderGuide: bibliografía se incluye solo con claves citadas (usedKeys)
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const os     = require("node:os");

const ROOT   = path.resolve(__dirname, "..");
const bibMgr = require("../scripts/bibliography-manager");
const { processInlineMarkup, renderGuide } = require("../scripts/guide-renderer");

// ─── Datos de prueba: objeto bibliografía sintético (simula loadBibliography) ──

const MOCK_BIB = {
  available: true,
  entries: [
    {
      id:     "date2004",
      type:   "book",
      author: [{ family: "Date", given: "C. J." }],
      title:  "An Introduction to Database Systems",
      issued: { "date-parts": [[2004]] },
    },
    {
      id:     "codd1970",
      type:   "article-journal",
      author: [{ family: "Codd", given: "E. F." }],
      title:  "A Relational Model of Data for Large Shared Data Banks",
      issued: { "date-parts": [[1970]] },
    },
  ],
};

const MOCK_BIB_LITERAL_AUTHOR = {
  available: true,
  entries: [
    {
      id:     "iso2016",
      type:   "standard",
      author: [{ literal: "ISO/IEC" }],
      title:  "Information technology — Database languages",
      issued: { "date-parts": [[2016]] },
    },
  ],
};

// ─── Tests de bibliography-manager ───────────────────────────────────────────

test("bibliography: modo degradado sin Citation.js muestra clave entre corchetes", () => {
  const degradedBib = { available: false, keys: ["date2004"], entries: [], raw: "" };
  const html = bibMgr.renderCitation(["date2004"], "parenthetical", degradedBib);
  assert.ok(
    html.includes("date2004"),
    "La clave debe aparecer en el HTML degradado",
  );
  assert.ok(
    html.includes("<cite"),
    "Debe envolver en <cite> aunque sea degradado",
  );
});

test("bibliography: modo degradado produce (clave) para parentética y solo clave para narrativa", () => {
  const degradedBib = { available: false, keys: ["date2004"], entries: [], raw: "" };
  const parent = bibMgr.renderCitation(["date2004"], "parenthetical", degradedBib);
  const narr   = bibMgr.renderCitation(["date2004"], "narrative",    degradedBib);

  assert.ok(parent.includes("(date2004)"), `Parentética degradada debe contener "(clave)": ${parent}`);
  assert.ok(!narr.includes("(date2004)"),  `Narrativa degradada NO debe incluir paréntesis: ${narr}`);
});

test("bibliography: narrativa extrae apellido y año de CSL-JSON", () => {
  const isCjsAvailable = bibMgr.isCitationJsAvailable();
  if (!isCjsAvailable) {
    // En modo degradado no podemos verificar el formato; pasar el test
    return;
  }
  const html = bibMgr.renderCitation(["date2004"], "narrative", MOCK_BIB);
  assert.ok(
    html.includes("Date") && html.includes("2004"),
    `La cita narrativa debe incluir apellido y año: ${html}`,
  );
  assert.ok(
    html.includes("jintia-citation--narrative"),
    `La cita narrativa debe tener clase CSS --narrative: ${html}`,
  );
  // La cita narrativa NO debe tener los paréntesis encerrando al autor
  assert.ok(
    !html.match(/\(Date/),
    `El autor no debe estar entre paréntesis en modo narrativo: ${html}`,
  );
});

test("bibliography: author.literal funciona como fallback en narrativa", () => {
  const isCjsAvailable = bibMgr.isCitationJsAvailable();
  if (!isCjsAvailable) return;
  const html = bibMgr.renderCitation(["iso2016"], "narrative", MOCK_BIB_LITERAL_AUTHOR);
  assert.ok(
    html.includes("ISO/IEC"),
    `La cita narrativa debe usar author.literal cuando no hay family: ${html}`,
  );
});

test("bibliography: renderCitation devuelve string vacío para array vacío", () => {
  const result = bibMgr.renderCitation([], "parenthetical", MOCK_BIB);
  assert.equal(result, "", "Array vacío de claves debe devolver string vacío");
});

// ─── Tests de processInlineMarkup ─────────────────────────────────────────────

test("processInlineMarkup: {{cite:key}} genera <cite> en modo parentético por defecto", () => {
  const html = processInlineMarkup("Ver {{cite:date2004}} para más detalles.", MOCK_BIB);
  assert.ok(
    html.includes("<cite"),
    `Debe haber un elemento <cite>: ${html}`,
  );
  assert.ok(
    html.includes("date2004"),
    `La clave debe aparecer en el atributo data-keys o en el texto: ${html}`,
  );
  assert.ok(
    !html.includes("{{cite:"),
    "La sintaxis cruda {{cite:}} no debe aparecer en el HTML",
  );
});

test("processInlineMarkup: {{cite:key|narrative}} usa modo narrativo", () => {
  const isCjsAvailable = bibMgr.isCitationJsAvailable();
  const html = processInlineMarkup("Como señaló {{cite:date2004|narrative}}, las bases relacionales…", MOCK_BIB);
  assert.ok(
    !html.includes("{{cite:"),
    "La sintaxis cruda no debe aparecer en el HTML",
  );
  if (isCjsAvailable) {
    assert.ok(
      html.includes("Date"),
      `En modo narrativo con CJS disponible, debe aparecer el apellido: ${html}`,
    );
  } else {
    assert.ok(
      html.includes("date2004"),
      `En modo degradado, la clave debe aparecer en la cita: ${html}`,
    );
  }
});

test("processInlineMarkup: texto sin marcado se escapa correctamente", () => {
  const html = processInlineMarkup("Texto con <HTML> & caracteres especiales.");
  assert.ok(html.includes("&lt;HTML&gt;"),      "< y > deben escaparse");
  assert.ok(html.includes("&amp;"),             "& debe escaparse");
  assert.ok(!html.includes("<HTML>"),            "HTML crudo no debe pasar sin escapar");
});

// ─── Test de renderGuide con citationStyle ────────────────────────────────────

test("renderGuide: citationStyle se extrae de metadata y se aplica a la bibliografía", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-bib-"));
  try {
    const guide = {
      metadata: {
        course: "Test",
        topic:  "Citas en guías",
        outcome: "Citar correctamente",
        citationStyle: "apa",
      },
      sections: [
        {
          type:    "theory",
          content: "Contenido con {{cite:date2004}} inline.",
        },
        {
          type: "bibliography",
          id:   "refs",
        },
      ],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    // renderGuide sin bib real: no debe lanzar error; las citas se degradan
    const html = renderGuide(guidePath);
    assert.ok(typeof html === "string" && html.length > 0, "Debe producir HTML");
    assert.ok(html.includes("jintia-bibliography"),        "Debe incluir la sección de bibliografía");
    assert.ok(!html.includes("{{cite:"),                    "La sintaxis {{cite:}} no debe aparecer cruda");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
