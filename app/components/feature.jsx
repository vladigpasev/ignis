// components/Features.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Package, Activity, Car } from "lucide-react";

export default function Features() {
  const features = [
    {
      icon: <Calendar className="h-8 w-8 text-gray-400 mx-auto" />,
      text: "Egestas elit dui scelerisque ut eu purus aliquam vitae habitasse.",
    },
    {
      icon: <Package className="h-8 w-8 text-gray-400 mx-auto" />,
      text: "Id eros pellentesque facilisi id mollis faucibus commodo enim.",
    },
    {
      icon: <Activity className="h-8 w-8 text-gray-400 mx-auto" />,
      text: "Nunc, pellentesque velit malesuada non massa arcu.",
    },
    {
      icon: <Car className="h-8 w-8 text-gray-400 mx-auto" />,
      text: "Imperdiet purus pellentesque sit mi nibh sit integer faucibus.",
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-screen-xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-12">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          {features.map((feature, index) => (
            <Card key={index} className="shadow-none border-0">
              <CardContent className="flex flex-col items-center space-y-4">
                {feature.icon}
                <p className="text-sm text-gray-600">{feature.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}