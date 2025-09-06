"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Logo + Social */}
        <div>
          <div className="mb-4">
            <Image src="/img/footer-logo.svg" alt="FireLinks" width={82} height={82} />
          </div>
          <div className="flex gap-4">
      <Link href="#" aria-label="LinkedIn">
        <Image
          src="/img/linkedin.svg"
          alt="LinkedIn"
          width={24}
          height={24}
          className="hover:opacity-80 transition"
        />
      </Link>
      <Link href="#" aria-label="Twitter">
        <Image
          src="/img/twitter.svg"
          alt="Twitter"
          width={24}
          height={24}
          className="hover:opacity-80 transition"
        />
      </Link>
      <Link href="#" aria-label="Instagram">
        <Image
          src="/img/instagram.svg"
          alt="Instagram"
          width={24}
          height={24}
          className="hover:opacity-80 transition"
        />
      </Link>
      <Link href="#" aria-label="Facebook">
        <Image
          src="/img/facebook.svg"
          alt="Facebook"
          width={24}
          height={24}
          className="hover:opacity-80 transition"
        />
      </Link>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <ul className="space-y-2">
            <li><Link href="#">За нас</Link></li>
            <li><Link href="#">Програми</Link></li>
            <li><Link href="#">Ресурси</Link></li>
            <li><Link href="#">Новини</Link></li>
          </ul>
          <ul className="mt-6 space-y-2 text-sm text-primary-foreground/80">
            <li><Link href="#">Общи условия</Link></li>
            <li><Link href="#">Политика за поверителност</Link></li>
            <li><Link href="#">Политика за закрила на детето</Link></li>
          </ul>
        </div>

        {/* Contacts */}
        <div>
          <h3 className="font-bold mb-3">Контакти</h3>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>0700 00 000 <br /> Общи въпроси</li>
            <li>0700 00 000 <br /> Консултации</li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h3 className="font-bold mb-3">Абонирайте се за нашия бюлетин</h3>
          <form className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="Имейл"
              className="px-4 py-2 rounded-[12px] w-full text-foreground bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground px-4 py-2 rounded-[12px]"
            >
              Абонирай се
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
}
