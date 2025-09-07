"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import dynamic from "next/dynamic";

const SubscribeModal = dynamic(() => import("./subscribe-modal"), { ssr: false });

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 w-full border-b border-border/60 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-md shadow-sm"
          : "bg-background/70 backdrop-blur"
      )}
    >
      <div
        className={cn(
          "max-w-7xl mx-auto px-4 flex items-center justify-between",
          scrolled ? "py-2" : "py-3"
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/img/logo.svg"
            alt="FireLinks Logo"
            width={32}
            height={32}
          />
          <span className="text-[24px] font-bold text-foreground">FireLinks</span>
        </Link>

        {/* Desktop Navigation + Actions */}
        <div className="hidden md:flex items-center gap-[21px]">
          <nav className="flex items-center gap-8">
            <Link
              href="#features"
              className="text-[18px] text-foreground hover:text-primary transition-colors"
            >
              Истории
            </Link>
            <Link
              href="#faq"
              className="text-[18px] text-foreground hover:text-primary transition-colors"
            >
              ЧЗВ
            </Link>
            <Link
              href="#contact"
              className="text-[18px] text-foreground hover:text-primary transition-colors"
            >
              Подкрепи
            </Link>
          </nav>

          {/* Actions */}
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <div className={cn("px-2 py-1")}>
                  <SubscribeModal />
                </div>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-foreground focus:outline-none"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur border-t border-border px-4 py-4 flex flex-col gap-4 shadow-sm">
          <Link
            href="#features"
            onClick={() => setIsOpen(false)}
            className="text-[18px] text-foreground hover:text-primary transition-colors"
          >
            Истории
          </Link>
          <Link
            href="#faq"
            onClick={() => setIsOpen(false)}
            className="text-[18px] text-foreground hover:text-primary transition-colors"
          >
            ЧЗВ
          </Link>
          <Link
            href="#contact"
            onClick={() => setIsOpen(false)}
            className="text-[18px] text-foreground hover:text-primary transition-colors"
          >
            Подкрепи
          </Link>
          {/* Subscribe CTA for mobile */}
          <div>
            <SubscribeModal />
          </div>
        </div>
      )}
    </header>
  );
}
