"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  const faqs = [
    {
      question: "Как мога да стана доброволец?",
      answer:
        "Можете да се регистрирате чрез нашата онлайн форма и да изберете в кои дейности бихте искали да участвате.",
    },
    {
      question: "Нужно ли е да имам опит?",
      answer:
        "Не, всеки е добре дошъл! Предоставяме базово обучение, за да може всеки доброволец да бъде подготвен.",
    },
    {
      question: "Колко време трябва да отделям?",
      answer:
        "Времето е изцяло по ваш избор. Може да участвате както еднократно, така и редовно.",
    },
    {
      question: "Има ли възрастови ограничения?",
      answer:
        "Доброволците трябва да са навършили 16 години. За непълнолетните е необходимо съгласие от родител/настойник.",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 text-center">
        {/* Caption & Title */}
        <p className="caption">
          Често задавани въпроси
        </p>
        <h2 className="heading-two pb-[64px]">
          Всичко, което трябва да знаете
        </h2>

        {/* Accordion */}
        <div className="max-w-3xl mx-auto text-left">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}