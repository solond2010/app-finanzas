# Mejora de la Web de Finanzas Personales Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Convertir la app de finanzas personales en un producto más claro, fiable y útil para uso diario, mejorando la jerarquía visual, la calidad de las métricas, la velocidad de captura de datos y la confianza en la sincronización.

**Architecture:** Mantener la base actual de Next.js + React + Tailwind + Tremor, pero separar mejor la capa de cálculo de la capa visual, endurecer el estado/sincronización y rediseñar el dashboard alrededor de 3 acciones clave: entender, registrar y actuar. El foco no es “más gráficos”, sino menos fricción y mejores decisiones.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Tremor, Recharts, Supabase, localStorage, lucide-react.

---

## Contexto actual

La app ya tiene una buena base:
- Dashboard visual moderno con tarjetas, gráficos y modo oscuro.
- Navegación lateral con rutas para dashboard, transacciones, cuentas, analíticas, objetivos y configuración.
- Persistencia local y sincronización con Supabase.
- Componentes reutilizables en `src/components/*`.

Lo que más mejoraría no es solo el diseño, sino la experiencia completa:
- La lectura del dashboard puede ser más “ejecutiva”.
- La captura de datos puede ser más rápida y menos dependiente de varios clicks.
- La app necesita más confianza: validación, mejores estados de sincronización y menos riesgo de inconsistencias.
- Las analíticas y objetivos deberían dar recomendaciones accionables, no solo datos.

---

## Propuesta de mejora priorizada

### 1) Rediseñar el dashboard para que responda a 3 preguntas
1. ¿Cómo va mi dinero hoy?
2. ¿Qué cambió respecto al mes anterior?
3. ¿Qué tengo que hacer ahora?

### 2) Reducir fricción en el registro de movimientos
- Crear movimiento en menos pasos.
- Reutilizar categorías y cuentas recientes.
- Añadir acciones rápidas más inteligentes.

### 3) Mejorar la calidad de las métricas
- Separar claramente cálculo, agregación y presentación.
- Introducir métricas útiles: ahorro real, gasto esencial vs no esencial, proyección de fin de mes, alertas de desvío.

### 4) Hacer la sincronización más confiable
- Estados visibles de guardado/sincronización.
- Manejo de errores y conflictos.
- Validación antes de persistir.

### 5) Subir el nivel de accesibilidad y pulido
- Mejor contraste y foco visible.
- Navegación por teclado.
- Empty states y loading states más útiles.

---

## Plan de ejecución

### Task 1: Definir la nueva jerarquía de información del producto

**Objective:** Aclarar qué debe ver el usuario primero en dashboard, transacciones y objetivos.

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/app/(main)/analytics/page.tsx`
- Modify: `src/app/(main)/objetivos/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Reordenar la propuesta de valor del dashboard**
- Encabezado con 3 elementos máximos: patrimonio neto, cambio mensual y una recomendación accionable.
- Mantener tarjetas de ingresos/gastos/neto/ahorro, pero con menos ruido visual.
- Reducir texto decorativo y aumentar el peso de los números y estados.

**Step 2: Definir CTAs primarios y secundarios**
- CTA principal: crear transacción.
- CTA secundario: crear cuenta / revisar analíticas.
- Evitar duplicar acciones que compiten entre sí.

**Step 3: Unificar lenguaje visual y copia**
- Revisar títulos y descripciones para que hablen de decisiones, no solo de datos.
- Ejemplo: “Tu dinero, en una sola lectura” puede evolucionar a una propuesta más concreta sobre control y acción.

**Validation:**
- El usuario debe entender en menos de 5 segundos: patrimonio, salud mensual y siguiente acción.

---

### Task 2: Separar y reforzar la capa de cálculos financieros

**Objective:** Hacer que las métricas sean más fiables, testeables y reutilizables.

**Files:**
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/format.ts`
- Modify: `src/lib/currency.ts`
- Modify: `src/lib/store.tsx`
- Add tests: `src/lib/__tests__/calculations.test.ts` (o la estructura de tests que se adopte)

**Step 1: Revisar fórmulas existentes**
- Validar ingresos, gastos, neto, patrimonio y progreso de objetivos.
- Evitar cálculos implícitos dentro de componentes de UI cuando puedan vivir en `src/lib/*`.

**Step 2: Añadir métricas nuevas**
- Ahorro real del mes.
- Gasto esencial vs no esencial.
- Proyección de cierre de mes.
- Ratio de cumplimiento de objetivos.

**Step 3: Escribir tests unitarios para las funciones clave**
- Casos con meses vacíos.
- Casos con ingresos/gastos mixtos.
- Casos con saldo inicial.
- Casos con múltiples monedas si la app lo soporta realmente.

**Step 4: Usar esas métricas desde la UI**
- Dashboard y analíticas deben consumir funciones puras, no recomputar lógica ad hoc.

**Validation:**
- Tests verdes.
- Las métricas deben coincidir en dashboard y analíticas para el mismo mes.

---

### Task 3: Mejorar la captura de transacciones y cuentas

**Objective:** Reducir el tiempo y la fricción para registrar datos.

**Files:**
- Modify: `src/components/dashboard/account-dialog.tsx`
- Modify: `src/components/dashboard/transactions-table.tsx`
- Modify: `src/components/layout/quick-actions.tsx`
- Modify: `src/app/(main)/transactions/page.tsx`
- Modify: `src/app/(main)/cuentas/page.tsx`

**Step 1: Diseñar un flujo rápido de alta de movimiento**
- Formulario compacto con campos mínimos obligatorios.
- Autocompletado de categoría, cuenta y tags.
- Recordar últimos valores usados.

**Step 2: Añadir acciones rápidas contextuales**
- “Añadir gasto habitual”.
- “Registrar ingreso”.
- “Transferencia entre cuentas”.
- “Crear objetivo”.

**Step 3: Mejorar edición y borrado**
- Confirmaciones más claras para acciones destructivas.
- Feedback inmediato cuando se crea/edita/elimina un movimiento.

**Step 4: Hacer más útil la tabla de transacciones**
- Filtros por mes, cuenta y categoría.
- Búsqueda por descripción.
- Estados vacíos con CTA útil.

**Validation:**
- Registrar una transacción no debería requerir “navegar” por la app.
- La tabla debe servir para revisar, no para descubrir el dato por casualidad.

---

### Task 4: Convertir el dashboard en un panel con recomendaciones

**Objective:** Pasar de “panel bonito” a “panel que ayuda a decidir”.

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/components/dashboard/monthly-summary.tsx`
- Modify: `src/components/dashboard/account-cards.tsx`
- Modify: `src/components/dashboard/sinking-funds.tsx`
- Modify: `src/components/shared/animated-number.tsx`

**Step 1: Sustituir métricas genéricas por insights accionables**
- Si el gasto sube, explicar dónde y por cuánto.
- Si el ahorro baja, sugerir el área de revisión.
- Si el objetivo está cerca, mostrar estimación de cierre.

**Step 2: Añadir una “tarjeta de recomendación”**
- Una sola recomendación principal por mes.
- Ejemplos:
  - “Reduce suscripciones para recuperar X €.”
  - “Vas camino de cumplir el objetivo antes de fecha.”
  - “El cash flow está sano; automatiza transferencias.”

**Step 3: Mejorar el bloque de tendencia**
- Comparativa mes actual vs anterior.
- Opción de ver 3, 6 y 12 meses.
- Etiquetas más legibles para no obligar a interpretar el gráfico.

**Step 4: Mejorar los estados vacíos**
- Si no hay datos, ofrecer un tutorial corto de 3 pasos.
- Incluir un ejemplo de primera cuenta y primera transacción.

**Validation:**
- Cada bloque del dashboard debe responder a una pregunta concreta.

---

### Task 5: Endurecer la sincronización, persistencia y validación

**Objective:** Evitar pérdida de datos y hacer transparente el estado real de la app.

**Files:**
- Modify: `src/lib/store.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/ui/toast.tsx`
- Modify: `src/lib/supabase.ts`
- Modify: `src/app/(main)/configuracion/page.tsx`

**Step 1: Revisar el flujo localStorage + Supabase**
- Asegurar que la carga inicial sea determinista.
- Evitar sobrescribir estado remoto con estado local incompleto.

**Step 2: Mejorar estados de sincronización**
- “Guardando”, “guardado”, “error” y “sin cambios”.
- Añadir explicaciones breves cuando falla la nube.

**Step 3: Añadir validación de entradas**
- Nombres vacíos.
- Cantidades negativas donde no correspondan.
- Cuentas duplicadas.
- Categorías inválidas.

**Step 4: Incluir plan de recuperación**
- Exportación/importación de datos.
- Botón de reset con confirmación fuerte.
- Mensaje claro sobre qué se guarda localmente y qué se sincroniza.

**Validation:**
- No debe haber un estado ambiguo entre local y nube.
- El usuario debe poder recuperar o exportar sus datos.

---

### Task 6: Mejorar accesibilidad, responsive y acabado visual

**Objective:** Que la app se sienta premium, consistente y usable en móvil y escritorio.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Ajustar contraste y foco visible**
- Verificar contraste de textos secundarios.
- Mejorar estados `focus-visible` para teclado.

**Step 2: Revisar navegación móvil**
- Sidebar más cómoda.
- Overlay y cierre más predecibles.
- Evitar que contenido importante quede oculto bajo el header móvil.

**Step 3: Reducir excesos visuales donde aporten poco**
- Mantener blur y gradients solo donde refuercen la lectura.
- Evitar que la decoración compita con los números.

**Step 4: Asegurar consistencia de componentes**
- Radios, sombras, espaciados y tipografía coherentes.
- Estados hover/active/disabled homogéneos.

**Validation:**
- Revisión manual en móvil, tablet y escritorio.
- Navegación 100% usable con teclado.

---

### Task 7: Añadir pruebas y verificación final

**Objective:** Evitar regresiones después del rediseño.

**Files:**
- Add tests: `src/lib/__tests__/*.test.ts`
- Add tests: `src/components/**/*.test.tsx` si el stack ya lo soporta
- Modify config if needed for el chosen test runner

**Step 1: Cubrir cálculos puros**
- Totales mensuales.
- Patrimonio.
- Progreso de objetivos.
- Reglas de sincronización/normalización si son puras.

**Step 2: Hacer una comprobación de build y lint**
- `npm run lint`
- `npm run build`

**Step 3: Prueba manual guiada**
- Crear cuenta.
- Crear transacción.
- Ver dashboard actualizado.
- Cambiar mes.
- Revisar analíticas.
- Confirmar que la sincronización refleja cambios.

**Validation:**
- Sin errores en lint/build.
- Flujo principal completo y estable.

---

## Orden recomendado de implementación

1. **Cálculos y validación**: primero la base de verdad.
2. **Dashboard e insights**: después la superficie principal.
3. **Captura rápida**: luego el flujo diario.
4. **Sincronización y recuperación**: para dar confianza.
5. **Accesibilidad y polish**: cerrar con calidad visual.
6. **Tests y verificación**: no como adorno, sino como cierre obligatorio.

---

## Riesgos y trade-offs

- **Demasiadas métricas**: una app financiera puede volverse ruidosa; mejor pocas métricas muy útiles.
- **Más UI no siempre ayuda**: priorizar claridad sobre decoración.
- **Sincronización compleja**: si localStorage y Supabase divergen, hay que resolver qué fuente manda.
- **Cambios visuales sin tests**: pueden romper cálculo o layout; por eso el plan empieza por la capa de lógica.

---

## Criterios de éxito

La mejora se considera buena si:
- El usuario entiende su situación financiera en segundos.
- Registrar datos cuesta menos esfuerzo.
- El dashboard dice qué hacer, no solo qué pasó.
- La app no inspira dudas sobre si guardó o sincronizó.
- La experiencia en móvil sigue siendo cómoda.

---

## Resultado esperado

Una app que pase de ser “bonita y funcional” a ser “útil todos los días”, con menos fricción, mejor lectura, mejores recomendaciones y más confianza en los datos.
