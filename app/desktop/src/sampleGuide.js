/**
 * Caso transversal usado para verificar la compilación y comparar plantillas.
 * Debe sentirse como una semana académica real sin depender de una profesión.
 */
export function buildSampleGuideData(config = {}) {
  const institution = safeSampleText(config.institution, "la institución");
  const career = safeSampleText(config.career, "el programa académico");

  return {
    courseCode: "DEMO-DEC-101",
    courseName: "Pensamiento crítico y decisiones profesionales",
    credits: 3,
    academicPeriod: safeSampleText(config.academicPeriod, "Período académico vigente"),
    semester: "Formación transversal",
    description:
      `Guía didáctica de muestra para ${career} en ${institution}. ` +
      "Presenta una semana completa de aprendizaje sobre cómo tomar decisiones justificadas con evidencia, " +
      "un proceso aplicable en salud, educación, ingeniería, administración, derecho y otras profesiones.",
    weeksData: [
      {
        number: 1,
        title: "De la intuición a una decisión justificable",
        unit: "Unidad I: Pensamiento crítico aplicado",
        topics:
          "Diferencia entre dato, evidencia e interpretación\n" +
          "Criterios para comparar alternativas\n" +
          "Sesgos frecuentes y manejo de la incertidumbre\n" +
          "Comunicación de una recomendación profesional",
        outcomes:
          "Analizar una situación profesional distinguiendo hechos, supuestos y vacíos de información\n" +
          "Comparar alternativas mediante criterios explícitos y evidencia pertinente\n" +
          "Justificar una recomendación reconociendo límites, riesgos y próximos pasos",
        bibliography:
          "Facione, P. A. (1990). Critical Thinking: A Statement of Expert Consensus. American Philosophical Association.\n" +
          "Hammond, J. S., Keeney, R. L., y Raiffa, H. (1999). Smart Choices. Harvard Business School Press.\n" +
          "Kahneman, D. (2011). Thinking, Fast and Slow. Farrar, Straus and Giroux.",
        teachingHours: 2,
        practiceHours: 2,
        autonomousHours: 4,
        gradedActivity:
          "Elabora una recomendación de una página para el caso de la semana. Incluye la decisión, " +
          "tres criterios comparables, dos evidencias verificables, un riesgo y una acción de seguimiento.",
      },
    ],
  };
}

function safeSampleText(value, fallback) {
  const clean = String(value || "")
    .trim()
    .replace(/[\\{}$&#_%~^]/g, " ")
    .replace(/\s+/g, " ");
  return clean || fallback;
}
