import fitz # PyMuPDF
import os

# PDF Cutter Template - Instructional Design Skill
# Extrae rangos de paginas de los libros en bibliografia/ y los guarda como
# lecturas semanales en bibliografia/recortes_por_semana/semana-XX/
# (la misma carpeta que consulta la Politica de Evidencia en references/bibliografia.md).
# Ejecutar desde la carpeta raiz del curso (ej. "01 CC05A_IFT200/").

# CONFIGURACIÓN: Offset y Recortes
# El offset es la diferencia para que la página impresa coincida con la física del PDF.
OFFSET = 0

cuts = [
    {
        "week": "01",
        "book": "nombre_archivo.pdf",
        "start": 1 + OFFSET, # Página impresa de inicio
        "end": 10 + OFFSET,  # Página impresa de fin
        "name": "Nombre_Descriptivo_Lectura"
    }
]

base_dir = "bibliografia"                                  # Carpeta raíz de libros
out_base = os.path.join("bibliografia", "recortes_por_semana")  # Destino de recortes

for cut in cuts:
    # Convención del repositorio: semana-XX (guion medio, dos dígitos)
    week_dir = os.path.join(out_base, f"semana-{cut['week']}")
    if not os.path.exists(week_dir):
        os.makedirs(week_dir)

    in_pdf_path = os.path.join(base_dir, cut["book"])
    out_pdf_path = os.path.join(week_dir, f"{cut['name']}.pdf")

    try:
        doc = fitz.open(in_pdf_path)
        out_doc = fitz.open()
        # insert_pdf usa 0-based indexing (por eso el -1)
        out_doc.insert_pdf(doc, from_page=cut["start"]-1, to_page=cut["end"]-1)
        out_doc.save(out_pdf_path)
        out_doc.close()
        doc.close()
        print(f"Éxito: Creado {out_pdf_path} (Páginas {cut['start']} a {cut['end']})")
    except Exception as e:
        print(f"Error al procesar {cut['name']}: {e}")
