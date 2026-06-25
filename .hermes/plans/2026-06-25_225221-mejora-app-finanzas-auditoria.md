# Mejora de App Finanzas Personales Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Subir la app de finanzas personales de “bonita y funcional” a “fiable, accionable y cómoda de usar todos los días”, manteniendo coste bajo/gratis.

**Architecture:** Mantener Next.js 16 + React 19 + TypeScript + Supabase, pero reforzar primero la base de datos/sincronización/cálculos, después mejorar captura e insights, y cerrar con accesibilidad, rendimiento y pruebas. La prioridad no es añadir más pantallas, sino hacer que las existentes den confianza y reduzcan fricción.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Tremor/Recharts, Supabase, localStorage, ESLint.

---

## Auditoría rápida realizada

Comandos ejecutados:

- `npm run build` → **pasa**. Next.js compila correctamente.
- `npm run lint` → **falla** con 14 errores y 11 warnings.
- Revisión de archivos principales: `src/lib/store.tsx`, `src/lib/calculations.ts`, `src/lib/supabase.ts`, `src/middleware.ts`, `src/components/dashboard/transactions-table.tsx`, `src/app/(main)/*`.

Hallazgos más importantes:

1. **Build OK, lint no OK.** La app compila, pero hay deuda técnica que conviene resolver antes de seguir metiendo features.
2. **Seguridad/Supabase débil.** `supabase/migration.sql` desactiva RLS y `src/middleware.ts` compara una cookie directamente con `APP_PASSWORD`. Funciona para uso personal, pero no es robusto si la URL se comparte o se filtra la anon key.
3. **No hay tests propios.** Las funciones financieras (`calculations.ts`, balance de cuentas, sincronización) son justo lo que más necesita pruebas.
4. **Sincronización potencialmente peligrosa.** `store.tsx` mezcla `localStorage` + Supabase y luego borra filas remotas que no estén localmente. Hay riesgo de pérdida de datos si el estado local está incompleto o viejo.
5. **Métricas con fórmulas simples.** El dashboard ya tiene buena pinta, pero puede dar insights más útiles: previsión de cierre de mes, gastos recurrentes, top desviaciones, recomendaciones concretas.
6. **Captura de movimientos mejorable.** Existe formulario y tabla, pero falta flujo ultra-rápido para gastos frecuentes, transferencias entre cuentas e importación CSV.
7. **Monedas incompletas.** Hay EUR/USD/CHF con tasas fijas (`src/lib/currency.ts`). Es aceptable para MVP, pero debería mostrarse como aproximado o permitir actualización manual.
8. **Next 16 avisa de deprecación.** `middleware` está deprecated y debe migrarse a `proxy` según el aviso de build.

---

## Principio de priorización

Para una app de finanzas, el orden correcto es:

1. **No perder datos.**
2. **No calcular mal.**
3. **Registrar movimientos rápido.**
4. **Entender qué hacer con el dinero.**
5. **Pulir diseño.**

La app ya tiene bastante diseño; ahora ganaría mucho más con confianza, tests, sincronización y mejores insights.

---

## Fase 0: Estabilizar calidad técnica

### Task 1: Arreglar lint y warnings bloqueantes

**Objective:** Dejar `npm run lint` en verde para que la base sea mantenible.

**Files:**
- Modify: `src/app/(main)/analytics/page.tsx`
- Modify: `src/app/(main)/cuentas/page.tsx`
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/components/dashboard/account-dialog.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/lib/store.tsx`

**Steps:**
1. Eliminar imports no usados.
2. Sustituir `any` en `store.tsx` por tipos explícitos de filas Supabase.
3. Revisar los `setState` dentro de `useEffect` que React 19/Compiler marca como problemáticos.
4. Corregir memoizaciones de `dashboard/page.tsx`: `selectedDate` debe ir en `useMemo` o derivarse sin romper dependencias.
5. Ejecutar `npm run lint`.
6. Ejecutar `npm run build`.

**Validation:**
- `npm run lint` debe terminar con 0 errores.
- `npm run build` debe seguir pasando.

---

### Task 2: Migrar `middleware.ts` a `proxy` para Next.js 16

**Objective:** Eliminar aviso de deprecación y alinearse con Next.js actual.

**Files:**
- Rename/Modify: `src/middleware.ts` → `src/proxy.ts` si la guía de Next 16 lo confirma.

**Steps:**
1. Leer la doc local de Next en `node_modules/next/dist/docs/` sobre `middleware-to-proxy` antes de tocar código.
2. Migrar el archivo siguiendo la convención de Next 16.
3. Verificar matcher y comportamiento de login.
4. Ejecutar `npm run build`.

**Validation:**
- Build sin warning de `middleware` deprecated.
- `/login`, `/dashboard` y redirecciones siguen funcionando.

---

## Fase 1: Proteger datos y sincronización

### Task 3: Diseñar fuente de verdad y estrategia anti-pérdida

**Objective:** Evitar que un `localStorage` viejo borre datos remotos.

**Files:**
- Modify: `src/lib/store.tsx`
- Modify: `src/app/(main)/configuracion/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Steps:**
1. Añadir campo lógico de versión/fecha de actualización por entidad o por estado global.
2. Cambiar `syncToSupabase` para no borrar remoto automáticamente sin confirmación o sin estrategia de reconciliación.
3. Mantener backup local antes de sincronizar cambios destructivos.
4. Mostrar estado claro: “solo local”, “sincronizando”, “guardado en nube”, “error: usando copia local”.
5. Añadir botón de exportación JSON completa además de CSV.
6. Añadir importación/restauración JSON validada.

**Validation:**
- Si Supabase falla, la app sigue funcionando localmente.
- Si local está vacío pero remoto tiene datos, no se borran.
- El usuario puede exportar todo y restaurarlo.

---

### Task 4: Endurecer Supabase y autenticación personal

**Objective:** Mantener gratis/barato pero más seguro.

**Files:**
- Modify: `supabase/migration.sql`
- Modify: `src/app/api/login/route.ts`
- Modify: `src/middleware.ts` or `src/proxy.ts`
- Modify: `src/lib/supabase.ts`

**Steps:**
1. No guardar la contraseña plana en cookie. Usar token firmado/HMAC o sesión aleatoria con expiración.
2. Añadir rate limiting básico al login si se despliega en plataforma que lo soporte, o al menos cooldown simple.
3. Revisar RLS: idealmente activar RLS y usar una clave/usuario controlado; si es app personal sin cuentas multiusuario, documentar explícitamente el riesgo.
4. Validar que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` existen antes de crear cliente; mostrar modo local si faltan.

**Validation:**
- Login incorrecto no revela detalles.
- Cookie no contiene `APP_PASSWORD`.
- La app no crashea si Supabase no está configurado.

---

## Fase 2: Hacer fiables los cálculos financieros

### Task 5: Añadir tests unitarios para cálculos

**Objective:** Probar lo más importante: dinero, meses, saldos y objetivos.

**Files:**
- Modify: `package.json`
- Add: `src/lib/__tests__/calculations.test.ts`
- Add: `src/lib/__tests__/currency.test.ts`
- Add: `src/lib/__tests__/store-reducer.test.ts` si se extrae el reducer.

**Steps:**
1. Añadir Vitest o test runner equivalente.
2. Testear `getMonthTotalsByString` con ingresos/gastos y meses vacíos.
3. Testear exclusión de saldos iniciales donde corresponda.
4. Testear `getAccountsAtMonth` y `getNetWorthAtMonth` con transacciones futuras.
5. Testear `calculateMonthlySaving` con fecha pasada, fecha actual y objetivo ya alcanzado.
6. Añadir script `npm test`.

**Validation:**
- `npm test` pasa.
- `npm run lint` pasa.
- `npm run build` pasa.

---

### Task 6: Crear una capa de “insights” financieros

**Objective:** Que el dashboard recomiende acciones, no solo muestre números.

**Files:**
- Add: `src/lib/insights.ts`
- Add: `src/lib/__tests__/insights.test.ts`
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/app/(main)/analytics/page.tsx`

**Insights iniciales recomendados:**
1. Mayor categoría de gasto del mes.
2. Categoría que más sube vs mes anterior.
3. Proyección de gasto a fin de mes.
4. Ahorro esperado vs objetivo 20%.
5. Objetivo/sinking fund en riesgo de no llegar a fecha.
6. Recomendación principal única del mes.

**Validation:**
- Con datos ejemplo, el dashboard muestra una recomendación concreta.
- Sin datos, muestra un onboarding útil en vez de métricas vacías.

---

## Fase 3: Reducir fricción diaria

### Task 7: Añadir captura rápida de movimientos

**Objective:** Registrar gasto/ingreso en menos de 10 segundos.

**Files:**
- Modify: `src/components/layout/quick-actions.tsx`
- Modify: `src/components/dashboard/transactions-table.tsx`
- Add: `src/components/transactions/quick-transaction-dialog.tsx`

**Steps:**
1. Crear modal compacto: tipo, monto, categoría, cuenta, descripción opcional.
2. Recordar última cuenta/categoría usada en `localStorage`.
3. Añadir botones: “Gasto”, “Ingreso”, “Transferencia”.
4. Validar monto positivo y cuenta seleccionada.
5. Mostrar toast con acción de deshacer si es viable.

**Validation:**
- Desde cualquier pantalla se puede crear un gasto sin navegar a transacciones.
- El saldo de la cuenta cambia correctamente.

---

### Task 8: Implementar transferencias entre cuentas

**Objective:** Evitar registrar transferencias como gastos reales.

**Files:**
- Modify: `src/lib/store.tsx`
- Modify: `src/lib/calculations.ts`
- Modify: `src/components/dashboard/transactions-table.tsx`
- Add tests.

**Steps:**
1. Ampliar modelo para soportar `tipo: "transferencia"` o crear dos movimientos enlazados por `transfer_group_id`.
2. Excluir transferencias de ingresos/gastos reales.
3. Actualizar saldos de cuenta origen y destino.
4. Mostrar transferencias de forma diferenciada en la tabla.

**Validation:**
- Transferir 100€ entre cuentas no cambia patrimonio neto.
- No cuenta como gasto ni ingreso mensual.

---

### Task 9: Importación CSV de banco

**Objective:** Ahorrar tiempo cuando haya muchas transacciones.

**Files:**
- Modify: `src/app/(main)/configuracion/page.tsx`
- Add: `src/lib/import-export.ts`
- Add: `src/lib/__tests__/import-export.test.ts`

**Steps:**
1. Permitir subir CSV.
2. Mapear columnas: fecha, descripción, importe, cuenta, categoría opcional.
3. Detectar duplicados por fecha+importe+descripción.
4. Previsualizar antes de importar.
5. Importar con rollback si algo falla.

**Validation:**
- Importar CSV no duplica movimientos ya existentes.
- El usuario ve cuántas filas se importarán y cuántas se ignoran.

---

## Fase 4: Mejorar dashboard y analíticas

### Task 10: Rediseñar dashboard alrededor de decisión diaria

**Objective:** Que en 5 segundos se entienda situación, riesgo y siguiente acción.

**Files:**
- Modify: `src/app/(main)/dashboard/page.tsx`
- Modify: `src/components/dashboard/monthly-summary.tsx`
- Modify: `src/components/dashboard/sinking-funds.tsx`

**Nueva jerarquía recomendada:**
1. Patrimonio neto + cambio mensual.
2. Cash flow del mes + tasa de ahorro.
3. Recomendación principal.
4. Top desviación de gasto.
5. Objetivos en riesgo.
6. Últimos movimientos.

**Validation:**
- Menos texto decorativo, más lectura accionable.
- El dashboard no repite lo mismo que analytics.

---

### Task 11: Analíticas con periodos y comparativas

**Objective:** Pasar de “gráficos bonitos” a análisis útil.

**Files:**
- Modify: `src/app/(main)/analytics/page.tsx`
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/insights.ts`

**Steps:**
1. Añadir selector 3/6/12 meses.
2. Mostrar ranking de categorías con cambio vs periodo anterior.
3. Añadir promedio mensual de gastos necesarios/no necesarios.
4. Añadir gasto recurrente detectado por tags o descripción.

**Validation:**
- El usuario puede responder “¿en qué estoy gastando más que antes?”.

---

## Fase 5: Pulido, accesibilidad y documentación

### Task 12: Accesibilidad y responsive

**Objective:** Hacer la app cómoda en móvil y teclado.

**Files:**
- Modify: `src/components/ui/*`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/globals.css`

**Steps:**
1. Revisar foco visible en botones, links, selects y dialogs.
2. Asegurar labels reales en inputs.
3. Hacer tablas legibles en móvil o usar vista tipo cards.
4. Validar contraste de texto secundario.

**Validation:**
- Navegación principal usable con teclado.
- Movimientos legibles en móvil sin scroll horizontal incómodo.

---

### Task 13: Documentar uso y despliegue gratuito

**Objective:** Que el proyecto sea fácil de mantener por ti.

**Files:**
- Modify: `README.md`
- Add: `.env.example`

**Steps:**
1. Explicar variables: `APP_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Explicar modo local sin Supabase.
3. Explicar cómo exportar/restaurar datos.
4. Explicar comandos: `npm run dev`, `npm run lint`, `npm run build`, `npm test`.

**Validation:**
- Una persona puede clonar, configurar y ejecutar la app sin preguntarte.

---

## Orden recomendado de ejecución

1. Fase 0: lint + deprecación Next.
2. Fase 1: protección de datos/sync/auth.
3. Fase 2: tests de cálculos + insights.
4. Fase 3: captura rápida + transferencias + importación.
5. Fase 4: dashboard/analytics más accionables.
6. Fase 5: accesibilidad + README.

---

## Criterios de éxito

La mejora está bien ejecutada si:

- `npm run lint`, `npm run build` y `npm test` pasan.
- No hay riesgo evidente de borrar datos remotos por un estado local viejo.
- La cookie de login no guarda la contraseña real.
- Las transferencias no contaminan ingresos/gastos.
- Registrar un gasto rápido toma menos de 10 segundos.
- El dashboard da una recomendación concreta y útil.
- Puedes exportar/restaurar toda tu información.

---

## Mi recomendación personal

No tocaría primero el diseño. Ya tiene una estética bastante buena. Haría primero una “fase de confianza”: lint, tests, sincronización segura, backup/import/export y autenticación menos frágil. Después metería captura rápida, transferencias e insights. Eso es lo que más valor real te va a dar en una app de finanzas personal.
