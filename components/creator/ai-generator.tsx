"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { addSquare } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Suggestion = { text: string; difficulty: string };

/**
 * "Generate Ideas" / "Add 10 more" (PRD §35). Suggestions are staged locally so
 * the creator can edit or drop them before anything is saved.
 */
export function AIGenerator({
  gameId,
  category,
  rating,
  existingSquares,
  defaultLocation,
}: {
  gameId: string;
  category: string;
  rating: string;
  existingSquares: string[];
  defaultLocation: string;
}) {
  const [location, setLocation] = useState(defaultLocation);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  async function generate(count: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/generate-squares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          category,
          rating,
          count,
          existingSquares: [
            ...existingSquares,
            ...suggestions.map((s) => s.text),
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not generate ideas.");
        return;
      }
      setSuggestions((current) => [...current, ...data.squares]);
    } catch {
      setError("Could not reach the idea generator.");
    } finally {
      setLoading(false);
    }
  }

  async function keep(index: number) {
    const suggestion = suggestions[index];
    setSavingIndex(index);
    const formData = new FormData();
    formData.set("game_id", gameId);
    formData.set("text", suggestion.text);
    formData.set("difficulty", suggestion.difficulty);
    try {
      const result = await addSquare({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuggestions((current) => current.filter((_, i) => i !== index));
    } catch {
      // Same shape as B-20: a rejected action left this suggestion spinning
      // on "saving" forever, with nothing said about why.
      setError("Could not save that square. Check your connection.");
    } finally {
      setSavingIndex(null);
    }
  }

  function edit(index: number, text: string) {
    setSuggestions((current) =>
      current.map((s, i) => (i === index ? { ...s, text } : s))
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="ai-location" className="text-xs">
            What are we watching?
          </Label>
          <Input
            id="ai-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Iowa State Fair"
          />
        </div>
        <Button
          type="button"
          onClick={() => generate(10)}
          disabled={loading || location.trim().length < 2}
        >
          <Sparkles data-icon="inline-start" aria-hidden />
          {loading
            ? "Thinking…"
            : suggestions.length
              ? "Add 10 Ideas"
              : "Generate Ideas"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {suggestions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.text}-${index}`} className="flex gap-2">
              <Input
                value={suggestion.text}
                onChange={(event) => edit(index, event.target.value)}
                aria-label="Suggested square"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => keep(index)}
                disabled={savingIndex === index}
              >
                {savingIndex === index ? "…" : "Keep"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSuggestions((current) =>
                    current.filter((_, i) => i !== index)
                  )
                }
              >
                Drop
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ideas are suggestions — edit or drop them before keeping.
        </p>
      )}
    </section>
  );
}
