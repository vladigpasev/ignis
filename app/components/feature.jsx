"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export default function Feature() {
  const features = [
    {
      title: "Спасените животни на Анна",
      description:
        "След опустошителния пожар в района на Витоша, Анна и нейният екип успяха да евакуират и осигурят подслон на над 50 домашни и диви животни.",
      image: "/img/deer.jpg",
    },
    {
      title: "Координацията на Петър",
      description:
        "Петър, бивш военен, доброволец в центъра за управление, координираше ресурсите така ефективно, че пожарът беше овладян преди да достигне до жилищните райони.",
      image: "/img/vladi.jpg",
      },
    {
      title: "Младежката инициатива за засаждане",
      description:
        "Група младежи от Петрич организираха кампания за засаждане на 5000 дървета в изгорените земи, за да върнат живота там.",
      image: "/img/forest.jpg",
    },
    {
      title: "Екипът на Димитър",
      description:
        "Димитър и неговите колеги психолози предоставиха безплатна кризисна подкрепа на над 100 засегнати от пожарите семейства в първите 72 часа.",
      image: "/img/team.jpg",
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 text-center">
        {/* Section Title */}
        <p className="caption">
          Силата на доброволчеството
        </p>
        <h2 className="heading-two pb-[64px]">
          Вдъхновяващи истории на доброволци
        </h2>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {features.map((feature, index) => (
            <Card key={index} className="flex flex-col pt-0">
              <CardHeader className="p-0">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  width={300}
                  height={200}
                  className="w-full h-40 object-cover bg-muted rounded-t-[12px]"
                />
              </CardHeader>
              <CardContent className="p-4 flex-1 text-left">
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
              <CardFooter className="p-4">
                <Button
                  variant="link"
                  className="text-primary font-medium"
                >
                  Още информация <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* CTA Button */}
        <Button className="button-primary">
          Виж още истории
        </Button>
      </div>
    </section>
  );
}
