"use client";

// ============================================================
// Piezas de formulario de perfil compartidas por Onboarding y Perfil
// ============================================================

import type { ActivityEntry, ActivityType, Goal, Sex, User } from "@/types";
import { ChoiceCard, Segmented, Stepper } from "@/components/ui/choice";
import { Field, parseNumberInput } from "@/components/ui/field";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, GOAL_LABELS } from "@/lib/profile";
import {
  PROFILE_LIMITS,
  validateBodyProfile,
  type GoalsInput,
  type ProfileErrors,
} from "@/lib/nutrition";

// ----- Estado del formulario --------------------------------------------------

export interface ProfileDraft {
  sex: Sex;
  age: string;
  heightCm: string;
  weightKg: string;
  goal: Goal;
  isActive: boolean;
  activities: ActivityEntry[];
}

export function draftFromProfile(profile: Partial<User> | null): ProfileDraft {
  const num = (n?: number) => (n && n > 0 ? String(n) : "");
  return {
    sex: profile?.sex ?? "male",
    age: num(profile?.age),
    heightCm: num(profile?.heightCm),
    weightKg: num(profile?.weightKg),
    goal: profile?.goal ?? "maintain",
    isActive: profile?.isActive ?? false,
    activities: profile?.activities ?? [],
  };
}

/** Convierte el borrador en input de cálculo, o devuelve errores */
export function parseDraft(
  draft: ProfileDraft,
): { ok: true; input: GoalsInput } | { ok: false; errors: ProfileErrors } {
  const body = {
    sex: draft.sex,
    age: parseNumberInput(draft.age),
    heightCm: parseNumberInput(draft.heightCm),
    weightKg: parseNumberInput(draft.weightKg),
  };
  const errors = validateBodyProfile(body);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      sex: draft.sex,
      age: Math.round(body.age!),
      heightCm: Math.round(body.heightCm!),
      weightKg: Math.round(body.weightKg! * 10) / 10,
      goal: draft.goal,
      isActive: draft.isActive && draft.activities.length > 0,
      activities: draft.isActive ? draft.activities : [],
    },
  };
}

// ----- Datos corporales ---------------------------------------------------------

export function BodyFields({
  draft,
  onChange,
  errors,
}: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-primary">Sexo biológico</span>
        <Segmented
          ariaLabel="Sexo biológico"
          value={draft.sex}
          onChange={(sex) => onChange({ sex })}
          options={[
            { value: "male", label: "Hombre" },
            { value: "female", label: "Mujer" },
          ]}
        />
        <span className="text-xs text-text-secondary">Se usa solo para la fórmula del metabolismo.</span>
      </div>
      <Field
        label="Edad"
        inputMode="numeric"
        type="number"
        min={PROFILE_LIMITS.age.min}
        max={PROFILE_LIMITS.age.max}
        placeholder="25"
        suffix="años"
        value={draft.age}
        onChange={(e) => onChange({ age: e.target.value })}
        error={errors.age}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Altura"
          inputMode="numeric"
          type="number"
          placeholder="175"
          suffix="cm"
          value={draft.heightCm}
          onChange={(e) => onChange({ heightCm: e.target.value })}
          error={errors.heightCm}
        />
        <Field
          label="Peso"
          inputMode="decimal"
          type="number"
          step="0.1"
          placeholder="75"
          suffix="kg"
          value={draft.weightKg}
          onChange={(e) => onChange({ weightKg: e.target.value })}
          error={errors.weightKg}
        />
      </div>
    </div>
  );
}

// ----- Objetivo -------------------------------------------------------------------

export function GoalPicker({ value, onChange }: { value: Goal; onChange: (goal: Goal) => void }) {
  return (
    <div role="radiogroup" aria-label="Objetivo" className="flex flex-col gap-3">
      {(Object.keys(GOAL_LABELS) as Goal[]).map((goal) => (
        <ChoiceCard
          key={goal}
          selected={value === goal}
          onClick={() => onChange(goal)}
          icon={GOAL_LABELS[goal].emoji}
          title={GOAL_LABELS[goal].title}
          description={GOAL_LABELS[goal].description}
        />
      ))}
    </div>
  );
}

// ----- Actividad física -------------------------------------------------------------

export function ActivityPicker({
  isActive,
  activities,
  onChange,
}: {
  isActive: boolean;
  activities: ActivityEntry[];
  onChange: (patch: { isActive?: boolean; activities?: ActivityEntry[] }) => void;
}) {
  const find = (type: ActivityType) => activities.find((a) => a.type === type);

  const toggle = (type: ActivityType) => {
    onChange({
      activities: find(type)
        ? activities.filter((a) => a.type !== type)
        : [...activities, { type, timesPerWeek: 3 }],
    });
  };

  const setTimes = (type: ActivityType, timesPerWeek: number) => {
    onChange({ activities: activities.map((a) => (a.type === type ? { ...a, timesPerWeek } : a)) });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-primary">¿Haces ejercicio?</span>
        <Segmented
          ariaLabel="¿Haces ejercicio?"
          value={isActive ? "yes" : "no"}
          onChange={(v) => onChange({ isActive: v === "yes" })}
          options={[
            { value: "yes", label: "Sí" },
            { value: "no", label: "No" },
          ]}
        />
      </div>

      {isActive && (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-text-primary">
            ¿Qué tipo? <span className="text-text-secondary font-normal">(puedes elegir varios)</span>
          </span>
          {ACTIVITY_TYPES.map((type) => {
            const entry = find(type);
            return (
              <ChoiceCard
                key={type}
                role="checkbox"
                selected={Boolean(entry)}
                onClick={() => toggle(type)}
                icon={ACTIVITY_LABELS[type].emoji}
                title={ACTIVITY_LABELS[type].title}
                description={ACTIVITY_LABELS[type].hint}
              >
                {entry && (
                  <div className="flex items-center justify-between gap-3 px-4 pb-4">
                    <span className="text-sm text-text-secondary">Veces por semana</span>
                    <Stepper
                      label={`veces por semana de ${ACTIVITY_LABELS[type].title}`}
                      value={entry.timesPerWeek}
                      min={1}
                      max={14}
                      onChange={(n) => setTimes(type, n)}
                    />
                  </div>
                )}
              </ChoiceCard>
            );
          })}
          {activities.length === 0 && (
            <p className="text-xs text-text-secondary">
              Elige al menos un tipo; si no, te calcularemos como sedentario.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
