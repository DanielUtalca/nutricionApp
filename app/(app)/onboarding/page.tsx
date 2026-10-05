"use client";

// ============================================================
// Onboarding — /onboarding
// ============================================================
// 4 pasos: datos corporales → objetivo → actividad → resumen de metas.
// Al confirmar guarda perfil + metas calculadas en users/{uid}.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { calculateGoals } from "@/lib/nutrition";
import { goalsToProfileFields } from "@/lib/profile";
import { addWeightLog } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  ActivityPicker,
  BodyFields,
  GoalPicker,
  draftFromProfile,
  parseDraft,
  type ProfileDraft,
} from "@/components/profile/profile-form-parts";
import { GoalsSummary } from "@/components/profile/goals-summary";
import type { ProfileErrors } from "@/lib/nutrition";

const STEPS = [
  { title: "Cuéntanos de ti", subtitle: "Lo usamos para estimar tu metabolismo." },
  { title: "¿Cuál es tu objetivo?", subtitle: "Puedes cambiarlo cuando quieras." },
  { title: "Tu actividad física", subtitle: "Mientras más preciso, mejor tu meta de calorías." },
  { title: "Tu plan diario", subtitle: "Calculado con Mifflin-St Jeor y tu actividad." },
];

export default function OnboardingPage() {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const goals = parsed.ok ? calculateGoals(parsed.input) : null;

  const next = () => {
    if (step === 0) {
      if (!parsed.ok) {
        setErrors(parsed.errors);
        return;
      }
      setErrors({});
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    if (!parsed.ok || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({
        ...parsed.input,
        ...goalsToProfileFields(parsed.input),
        onboardingCompleted: true,
      });
      // Primer registro de peso para el gráfico de evolución (no bloquea si falla)
      addWeightLog(user.uid, { date: todayKey(), weightKg: parsed.input.weightKg }).catch((err) =>
        console.error("No se pudo crear el primer registro de peso:", err),
      );
      router.replace("/home");
    } catch (err) {
      console.error("Error guardando onboarding:", err);
      setSaveError("No pudimos guardar tu perfil. Revisa tu conexión e intenta de nuevo.");
      setSaving(false);
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <main className="min-h-dvh flex flex-col bg-bg-base">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-4 pt-6 pb-4">
        {/* Progreso */}
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
              aria-label="Volver al paso anterior"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="w-7" />
          )}
          <div
            className="flex-1 flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={`Paso ${step + 1} de ${STEPS.length}`}
          >
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <span className="text-xs text-text-secondary tabular w-7 text-right">
            {step + 1}/{STEPS.length}
          </span>
        </div>

        <header className="mt-8 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{STEPS[step].title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{STEPS[step].subtitle}</p>
        </header>

        <section className="flex-1">
          {step === 0 && <BodyFields draft={draft} onChange={patch} errors={errors} />}
          {step === 1 && <GoalPicker value={draft.goal} onChange={(goal) => patch({ goal })} />}
          {step === 2 && (
            <ActivityPicker isActive={draft.isActive} activities={draft.activities} onChange={patch} />
          )}
          {step === 3 && goals && (
            <div className="flex flex-col gap-4">
              <GoalsSummary goals={goals} />
              <p className="text-xs text-text-secondary text-center">
                Son estimaciones. Podrás ajustarlas a mano desde tu perfil.
              </p>
            </div>
          )}
        </section>

        {saveError && (
          <p role="alert" className="mb-3 text-sm rounded-xl px-3 py-2 bg-danger-muted text-danger">
            {saveError}
          </p>
        )}

        <div className="sticky bottom-0 pt-4 pb-safe bg-bg-base">
          {isLast ? (
            <Button size="lg" fullWidth onClick={finish} loading={saving}>
              Empezar
            </Button>
          ) : (
            <Button size="lg" fullWidth onClick={next}>
              Continuar
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
