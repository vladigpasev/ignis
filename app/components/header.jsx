"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, NavigationMenuLink } from "@/components/ui/navigation-menu";
import AuthNav from "./auth-nav";

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
              <Link href="#" legacyBehavior passHref>
                <NavigationMenuLink className={cn("px-4 py-2 text-gray-700 hover:text-black transition-colors")}>
                  Eleven
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="#" legacyBehavior passHref>
                <NavigationMenuLink className={cn("px-4 py-2 text-gray-700 hover:text-black transition-colors")}>
                  Twelve
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="#" legacyBehavior passHref>
                <NavigationMenuLink className={cn("px-5 py-2 text-gray-700 hover:text-black transition-colors")}>
                  <AuthNav />
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}