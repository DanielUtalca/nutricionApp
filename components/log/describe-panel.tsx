"use client";

// Describir la comida con texto → la IA estima alimentos y macros

import { useState } from "react";
import { analyzeMealText, ApiError, type AnalyzeResponse } from "@/lib/api-client";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/ai/image";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/page";
import { SparkIcon } from "@/components/ui/icons";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function DescribePanel({ onResult }: { onResult: (res: AnalyzeResponse) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      onResult(await analyzeMealText(text));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo analizar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">¿Qué comiste?</span>
        <textarea
          className={cn(inputClasses, "h-auto min-h-32 py-3 resize-none")}
          placeholder="Ej: 2 huevos revueltos, 1 marraqueta con palta y un café con leche"
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="text-xs text-text-secondary text-right tabular">
          {text.length}/{MAX_DESCRIPTION_LENGTH}
        </span>
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button size="lg" fullWidth onClick={analyze} loading={loading} disabled={text.trim().length < 3}>
        <SparkIcon size={18} /> Estimar con IA
      </Button>
    </div>
  );
}
