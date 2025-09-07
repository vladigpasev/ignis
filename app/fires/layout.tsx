import type { ReactNode } from "react";
import FiresHeader from "@/components/fires/fires-header";

export default function FiresLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <FiresHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}

