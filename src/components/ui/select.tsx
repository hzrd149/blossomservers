import * as React from "react";

import { cn } from "@/lib/utils";

/** A styled native select, native controls work best on mobile */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    style={{ border: "1px solid var(--color-input)" }}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
