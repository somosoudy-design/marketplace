# Revisión independiente del camino de publicación · Tecnología

Dictamen favorable al aislamiento del candidato visual, sin autorización ni ejecución de publicación.

Por lectura de objetos Git, `dcee73d95d1b818a25a9d34a5e97c6f1f248b7fd` añade únicamente seis paths sobre `884611780a1a3207aca9c3f3d8703b0324f65718`: Home, ProductPhoto, helper por categoría, máscara PNG, procedencia y un archivo con tres pruebas focales. No son tres archivos de pruebas.

El árbol propuesto `6f0b52c4ec80fc4a5c86bb72fdb4146c6a803594`, comparado con la última base web publicada documentada `db41707f0c35e7e4e50373321225b03a2fd6ade0`, cambia exactamente esos mismos seis paths. Los seis blobs coinciden con dcee73d9. Todo otro path conserva el contenido de db41707f: no se trasladan Google, cuotas ni configuración/fuente Android de 8846117. No publicar el árbol completo de dcee73d9, que sí conserva trabajo pendiente de su padre. `visual-only.patch` tiene SHA256 `d53f464d89713d2af960f46f35ed5c7e90d089dc938d4fc1a79442e409f7b1c0`.

La máscara sólo se asigna si coinciden slug `tecnologia` y path exacto del JPEG previsto. El img mantiene su src original y el cálculo anterior de imagen; CSS aplica maskMode alpha. Audio, Odontología y otros paths no reciben la máscara. `readyMask` comienza en null y sólo cambia en onload del probe de la máscara: un 404 en esa carga inicial no instala CSS mask y conserva el original. No se borra ni sustituye el JPEG. El onError previo de la imagen original continúa disponible. Esta comprobación es de código; el ensayo 404/píxeles pertenece a la evidencia del integrador, no fue repetido aquí.

Se leyó el recibo de integridad con 147 originales coincidentes y cero modificados. No se recalcularon esos 147 hashes ni se repitieron capturas o comparación de píxeles. La procedencia distingue máscara aproximada generada y RGB original; la fidelidad del contorno, incluido el stylus, queda limitada a la revisión visual ya aportada.

No se ejecutaron suites, build, HTTP remoto, navegador ni despliegue. La base db41707f es la última publicación documentada, no una nueva comprobación de la versión hospedada. Antes de publicar se debe reconciliar con el estado vigente; este dictamen sólo acredita el alcance local de seis paths y el fallback descrito.
