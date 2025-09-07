"use client";

import * as React from "react";

type CheckboxProps = React.ComponentPropsWithoutRef<"input"> & {
  checked?: boolean | undefined;
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({ checked, onCheckedChange, className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={"h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " + (className || "")}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}

export default Checkbox;

