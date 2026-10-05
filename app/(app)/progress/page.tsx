"use client";

// ============================================================
// Progreso — /progress: peso (gráfico), medidas opcionales e historial
// ============================================================

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { useCollection } from "@/lib/hooks";
import { addWeightLog, deleteWeightLog, paths, type WeightLogInput } from "@/lib/db";
import { formatShortDate, isDateKey, todayKey } from "@/lib/dates";
import { filterRange, measurementChange, sortByDate, weightStats, type RangeKey } from "@/lib/progress";
import { goalsToProfileFields } from "@/lib/profile";
import { PROFILE_LIMITS } from "@/lib/nutrition";
import type { WeightLog } from "@/types";
import { Page, PageHeader, ErrorNote, EmptyState } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/choice";
import { Field, parseNumberInput } from "@/components/ui/field";
import { ScaleIcon, TrashIcon } from "@/components/ui/icons";
import { WeightChart } from "@/components/progress/weight-chart";

const MEASURES = [
  { key: "waistCm", label: "Cintura" },
  { key: "hipCm", label: "Cadera" },
  { key: "chestCm", label: "Pecho" },
  { key: "armCm", label: "Brazo" },
] as const;

const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmt(Math.abs(n))}`;

export default function ProgressPage() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const today = todayKey();
  const { data: logs, loading } = useCollection<WeightLog>(user ? paths.weightLogs(user.uid) : null, [], "all");
  const [range, setRange] = useState<RangeKey>("3m");
  const [showTable, setShowTable] = useState(false);

  const sorted = useMemo(() => sortByDate(logs), [logs]);
  const inRange = useMemo(() => filterRange(logs, range, today), [logs, range, today]);
  const stats = weightStats(inRange);
  const latest = sorted[sorted.length - 1];

  // ----- Formulario -----
  const [form, setForm] = useState({ date: today, weight: "", waistCm: "", hipCm: "", chestCm: "", armCm: "" });
  const [showMeasures, setShowMeasures] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const weightKg = parseNumberInput(form.weight);
    const { min, max } = PROFILE_LIMITS.weightKg;
    if (!weightKg || weightKg < min || weightKg > max) {
      return setMessage({ type: "error", text: `Ingresa un peso entre ${min} y ${max} kg.` });
    }
    if (!isDateKey(form.date) || form.date > today) {
      return setMessage({ type: "error", text: "La fecha no puede ser futura." });
    }
    const input: WeightLogInput = { date: form.date, weightKg: Math.round(weightKg * 10) / 10 };
    for (const { key } of MEASURES) {
      const v = parseNumberInput(form[key]);
      if (v && v > 0 && v < 300) input[key] = Math.round(v * 10) / 10;
    }
    setSaving(true);
    setMessage(null);
    try {
      await addWeightLog(user.uid, input);
      // Si es el registro más reciente, actualiza el peso del perfil y (si no
      // fueron editadas a mano) recalcula las metas con el nuevo peso.
      let text = "Registro guardado.";
      if (!latest || form.date >= latest.date) {
        const recalc = !profile.goalsCustomized;
        await updateProfile({
          weightKg: input.weightKg,
          ...(recalc
            ? goalsToProfileFields({
                sex: profile.sex,
                age: profile.age,
                heightCm: profile.heightCm,
                weightKg: input.weightKg,
                goal: profile.goal,
                isActive: profile.isActive,
                activities: profile.activities,
              })
            : {}),
        });
        if (recalc && Math.abs(input.weightKg - profile.weightKg) >= 0.1) {
          text = "Registro guardado. Recalculamos tus metas con tu nuevo peso.";
        }
      }
      setMessage({ type: "ok", text });
      setForm({ date: today, weight: "", waistCm: "", hipCm: "", chestCm: "", armCm: "" });
      setShowMeasures(false);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "No se pudo guardar. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  const measures = MEASURES.map((m) => ({ ...m, value: measurementChange(logs, m.key) })).filter((m) => m.value);

  return (
    <Page>
      <PageHeader title="Progreso" subtitle="Peso y medidas" back="/home" />

      {/* Resumen */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-text-secondary">Peso actual</p>
            <p className="text-3xl font-bold tracking-tight" data-testid="current-weight">
              {fmt(latest?.weightKg ?? stats.latest)} <span className="text-base font-medium text-text-secondary">kg</span>
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-secondary">Cambio en el período</p>
            <p className="text-3xl font-bold tracking-tight">
              {signed(stats.change)} <span className="text-base font-medium text-text-secondary">kg</span>
            </p>
          </Card>
        </div>
      )}

      {/* Gráfico */}
      <Card className="p-4 flex flex-col gap-3">
        <SectionTitle
          action={
            inRange.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTable((s) => !s)}
                className="text-xs font-medium text-primary cursor-pointer"
              >
                {showTable ? "Ver gráfico" : "Ver tabla"}
              </button>
            )
          }
        >
          Evolución del peso
        </SectionTitle>
        <Segmented
          ariaLabel="Rango del gráfico"
          value={range}
          onChange={setRange}
          options={[
            { value: "1m", label: "1 mes" },
            { value: "3m", label: "3 meses" },
            { value: "1y", label: "1 año" },
            { value: "all", label: "Todo" },
          ]}
        />
        {loading ? (
          <div className="h-[220px]" />
        ) : inRange.length === 0 ? (
          <EmptyState
            icon={<ScaleIcon size={32} />}
            title="Sin registros en este período"
            description="Registra tu peso abajo; te recomendamos hacerlo 1 vez por semana, en ayunas."
          />
        ) : showTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary">
                <th className="font-medium py-1.5">Fecha</th>
                <th className="font-medium py-1.5 text-right">Peso</th>
                <th className="font-medium py-1.5 text-right">Cintura</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...inRange].reverse().map((l) => (
                <tr key={l.id} className="border-t border-border-subtle">
                  <td className="py-1.5">{formatShortDate(l.date)}</td>
                  <td className="py-1.5 text-right">{fmt(l.weightKg)} kg</td>
                  <td className="py-1.5 text-right text-text-secondary">{l.waistCm ? `${fmt(l.waistCm)} cm` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <WeightChart points={inRange} />
        )}
      </Card>

      {/* Registrar */}
      <Card className="p-4">
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <SectionTitle>Nuevo registro</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Peso"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={profile?.weightKg ? fmt(profile.weightKg) : "75"}
              suffix="kg"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
            <Field
              label="Fecha"
              type="date"
              max={today}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          {showMeasures ? (
            <div className="grid grid-cols-2 gap-3">
              {MEASURES.map(({ key, label }) => (
                <Field
                  key={key}
                  label={label}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  suffix="cm"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMeasures(true)}
              className="self-start text-sm font-medium text-primary cursor-pointer"
            >
              + Agregar medidas (opcional)
            </button>
          )}
          {message &&
            (message.type === "error" ? (
              <ErrorNote>{message.text}</ErrorNote>
            ) : (
              <p role="status" className="text-sm rounded-xl px-3.5 py-2.5 bg-primary-muted">
                {message.text}
              </p>
            ))}
          <Button type="submit" loading={saving}>
            Guardar registro
          </Button>
        </form>
      </Card>

      {/* Medidas */}
      {measures.length > 0 && (
        <Card className="p-4 flex flex-col gap-3">
          <SectionTitle>Medidas</SectionTitle>
          <dl className="grid grid-cols-2 gap-3">
            {measures.map(({ key, label, value }) => (
              <div key={key} className="rounded-xl bg-bg-subtle p-3">
                <dt className="text-xs text-text-secondary">{label}</dt>
                <dd className="text-lg font-semibold">
                  {fmt(value!.latest)} cm{" "}
                  {value!.change !== 0 && (
                    <span className="text-xs font-normal text-text-secondary">({signed(value!.change)})</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* Historial */}
      {sorted.length > 0 && (
        <Card className="p-4 flex flex-col gap-2">
          <SectionTitle>Historial</SectionTitle>
          <ul className="divide-y divide-border-subtle">
            {[...sorted]
              .reverse()
              .slice(0, 12)
              .map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="text-text-secondary w-16">{formatShortDate(l.date)}</span>
                  <span className="flex-1 font-medium tabular">{fmt(l.weightKg)} kg</span>
                  <button
                    type="button"
                    onClick={() => user && deleteWeightLog(user.uid, l.date).catch(console.error)}
                    className="w-8 h-8 rounded-lg text-text-disabled hover:text-danger hover:bg-danger-muted flex items-center justify-center cursor-pointer"
                    aria-label={`Borrar registro del ${formatShortDate(l.date)}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
