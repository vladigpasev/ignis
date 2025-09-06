"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Phone, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import AuthNav from "./auth-nav";
import dynamic from "next/dynamic";

const SubscribeModal = dynamic(() => import("./subscribe-modal"), { ssr: false });

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="w-full border-b border-border bg-background pt-2 pb-2">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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

        {/* Desktop Navigation + Phone + Actions */}
        <div className="hidden md:flex items-center gap-[21px]">
          <nav className="flex items-center gap-8">
            <Link
              href="#"
              className="text-[18px] text-foreground hover:text-primary"
            >
              За нас
            </Link>
            <Link
              href="#"
              className="text-[18px] text-foreground hover:text-primary"
            >
              HeatMap
            </Link>
            <Link
              href="#"
              className="text-[18px] text-foreground hover:text-primary"
            >
              Подкрепи
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-foreground" />
            <span className="text-[18px] font-bold text-primary">
              0700 00 000
            </span>
          </div>

          {/* Actions */}
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn("px-4 py-2 text-foreground/80 hover:text-foreground transition-colors")}
                >
                  <Link href="#">Eleven</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn("px-4 py-2 text-foreground/80 hover:text-foreground transition-colors")}
                >
                  <Link href="#">Twelve</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <div className={cn("px-2 py-1")}>
                  <SubscribeModal />
                </div>
              </NavigationMenuItem>
              <NavigationMenuItem>
                {/* Auth navigation renders its own <a> elements; do not nest in Link */}
                <div className={cn("px-5 py-2")}>
                  <AuthNav />
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
        <div className="md:hidden bg-background border-t border-border px-4 py-4 flex flex-col gap-4">
          <Link
            href="#"
            className="text-[18px] text-foreground hover:text-primary"
          >
            За нас
          </Link>
          <Link
            href="#"
            className="text-[18px] text-foreground hover:text-primary"
          >
            HeatMap
          </Link>
          <Link
            href="#"
            className="text-[18px] text-foreground hover:text-primary"
          >
            Подкрепи
          </Link>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-foreground" />
            <span className="text-[18px] font-bold text-primary">
              0700 00 000
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
