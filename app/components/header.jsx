"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, NavigationMenuLink } from "@/components/ui/navigation-menu";
import AuthNav from "./auth-nav";
import dynamic from "next/dynamic";

const SubscribeModal = dynamic(() => import("./subscribe-modal"), { ssr: false });

export default function Header() {
  return (
    <header>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left side - Logo */}
        <div className="flex items-center gap-2">
          <Image 
            src="/logo.svg" 
            alt="WebbyFrames Logo" 
            width={181} 
            height={39} 
          />
        </div>

        {/* Right side - Nav */}
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={cn("px-4 py-2 text-gray-700 hover:text-black transition-colors")}>
                <Link href="#">Eleven</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={cn("px-4 py-2 text-gray-700 hover:text-black transition-colors")}>
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
    </header>
  );
}
