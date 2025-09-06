"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Phone, Menu, X } from "lucide-react";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="w-full border-b border-gray-200 bg-white pt-2 pb-2">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/img/logo.svg"
            alt="FireLinks Logo"
            width={32}
            height={32}
          />
          <span className="text-[24px] font-bold text-[#21272A]">FireLinks</span>
        </Link>

        {/* Desktop Navigation + Phone */}
        <div className="hidden md:flex items-center gap-[21px]">
          <nav className="flex items-center gap-8">
            <Link
              href="#"
              className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
            >
              За нас
            </Link>
            <Link
              href="#"
              className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
            >
              HeatMap
            </Link>
            <Link
              href="#"
              className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
            >
              Подкрепи
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#21272A]" />
            <span className="text-[18px] font-bold text-[#e65300]">
              0700 00 000
            </span>
          </div>
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#21272A] focus:outline-none"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 py-4 flex flex-col gap-4">
          <Link
            href="#"
            className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
          >
            За нас
          </Link>
          <Link
            href="#"
            className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
          >
            HeatMap
          </Link>
          <Link
            href="#"
            className="text-[18px] text-[#21272A] hover:text-[#DD6630]"
          >
            Подкрепи
          </Link>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#21272A]" />
            <span className="text-[18px] font-bold text-[#e65300]">
              0700 00 000
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
