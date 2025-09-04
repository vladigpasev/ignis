import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { User } from "lucide-react"

const testimonials = [
  {
    text: "Nibh elit lacus mi elit, dui maecenas vestibulum cursus. Aliquet quam cursus tortor eu a.",
    author: "Author One",
    role: "Role One",
  },
  {
    text: "Ornare quisque ullamcorper a eleifend fringilla turpis. Suspendisse potenti.",
    author: "Author Two",
    role: "Role Two",
  },
]

export default function Testimonials() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-screen-md mx-auto px-4">
        <Carousel className="w-full">
          <CarouselContent>
            {testimonials.map((t, i) => (
              <CarouselItem key={i}>
                <Card className="text-center shadow-none border-0 bg-gray-50">
                  <CardContent className="flex flex-col items-center space-y-4 pt-8">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed max-w-lg mx-auto">
                      {t.text}
                    </p>
                  </CardContent>
                  <CardFooter className="flex flex-col items-center space-y-1 pb-8">
                    <p className="font-semibold">{t.author}</p>
                    <p className="text-sm text-gray-500">{t.role}</p>
                  </CardFooter>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden max-[850px]:flex justify-center gap-4 mt-4">
        <CarouselPrevious />
        <CarouselNext />
        </div>

        <CarouselPrevious className="max-[850px]:hidden" />
        <CarouselNext className="max-[850px]:hidden" />
        </Carousel>
      </div>
    </section>
  )
}