"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col lg:flex-row items-center gap-10">
        {/* Left Side - Image */}
        <div className="flex-1 flex justify-center">
          <Image
            src="/img/hero.jpg" // replace with your image path
            alt="Volunteer"
            width={400}
            height={400}
            className="rounded-2xl object-cover"
          />
        </div>

        {/* Right Side - Text */}
        <div className="flex-1 text-center lg:text-left">
          <p className="caption">
            Обединени срещу пожарите
          </p>
          <h1 className="heading-one mb-12">
            Стани доброволец в борбата с пожарите
          </h1>
          <p className="body-text mb-16">
            Всеки доброволец е ценен! С твоята помощ можем да реагираме по-бързо и да ограничим щетите от пожарите. 
            Регистрирай се и стани част от екип, който се бори за природата и хората.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button className="button-primary">
              Стани доброволец &rarr;
            </Button>
            <Button
              className="button-secondary"
            >
              Вече си доброволец &rarr;
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}