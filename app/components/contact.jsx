"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ContactForm() {
  const form = useForm({
    defaultValues: {
      amount: 20,
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(values) {
    setError("");
    const raw = Number(values?.amount);
    const amount = Number.isFinite(raw) ? Math.round(raw) : 0;
    if (!amount || amount < 2) {
      setError("Минималната сума за дарение е 2 лв.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency: "bgn" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Възникна грешка. Опитайте отново.");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e?.message || "Възникна грешка. Опитайте отново.");
    } finally {
      setSubmitting(false);
    }
  }

  const presets = [5, 10, 20, 50, 100];
  const current = Number(form.watch("amount")) || 0;

  return (
    <section className="py-20 bg-accent w-full">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <p className="caption">Подкрепи каузата</p>
        <h2 className="heading-two pb-[24px]">
          Твоето дарение спасява животи и природа
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Сигурно плащане чрез Stripe. Ние не съхраняваме данни за картата.
        </p>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 text-left"
          >
            <div className="flex flex-wrap gap-2 justify-center">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => form.setValue("amount", p)}
                  className={`px-4 py-2 rounded-full border transition ${
                    current === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-muted-foreground/20"
                  }`}
                >
                  {p} лв
                </button>
              ))}
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сума (лв)</FormLabel>
                  <FormControl className="bg-background">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex items-center justify-center gap-4">
              <Button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? "Пренасочване…" : "Дарете сега"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Минимум 2 лв • Без скрити такси
              </span>
            </div>
          </form>
        </Form>
      </div>
    </section>
  );
}
