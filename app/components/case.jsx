// components/CaseStudies.tsx
"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function CaseStudies() {
  const cases = [
    {
      title: "Title",
      text: "Egestas elit dui scelerisque ut eu purus aliquam vitae habitasse.",
    },
    {
      title: "Title",
      text: "Id eros pellentesque facilisi id mollis faucibus commodo enim.",
    },
    {
      title: "Title",
      text: "Nunc, pellentesque velit malesuada non massa arcu.",
    },
    {
      title: "Title",
      text: "Imperdiet purus pellentesque sit mi nibh sit integer faucibus.",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Section heading */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
            Case Studies
          </p>
          <h2 className="text-2xl font-bold mt-2">
            Interdum sollicitudin tortor viverra porta consequat in.
          </h2>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {cases.map((item, index) => (
            <Card key={index} className="shadow-sm">
              <CardHeader className="bg-gray-100 h-40 flex items-center justify-center">
                <div className="w-16 h-16 bg-gray-300" /> {/* Placeholder image */}
              </CardHeader>
              <CardContent className="pt-4">
                <CardTitle className="text-base mb-2">{item.title}</CardTitle>
                <p className="text-sm text-gray-600">{item.text}</p>
              </CardContent>
              <CardFooter>
                <a
                  href="#"
                  className="text-blue-600 text-sm font-semibold flex items-center gap-1 hover:underline"
                >
                  More Info <ArrowRight className="w-4 h-4" />
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* CTA button */}
        <div className="text-center">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6">
            Contact Me
          </Button>
        </div>
      </div>
    </section>
  );
}