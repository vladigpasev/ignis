"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative w-full h-[600px] flex items-center justify-center">
      {/* Background Image */}
      <Image
        src="/img/ai.jpg" // replace with your background image
        alt="Firefighter"
        fill
        priority
        className="opacity-20 object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-white/15" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 w-full">
        <div className="max-w-2xl p-8 rounded-[12px]">
          <p className="caption text-accent mb-2">
            ОБЕДИНЕНИ СРЕЩУ ПОЖАРИТЕ
          </p>
          <h1 className="heading-one mb-6">
            Стани доброволец в борбата с пожарите
          </h1>
          <p className="body-text text-foreground mb-8">
            Всеки доброволец е ценен! С твоята помощ можем да реагираме по-бързо
            и да ограничим щетите от пожарите. Регистрирай се и стани част от
            екип, който се бори за природата и хората.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button className="button-primary">
              Стани доброволец &rarr;
            </Button>
            <Button className="button-secondary">
              Вече си доброволец &rarr;
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
