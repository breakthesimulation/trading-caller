"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, useState, type ReactNode } from "react";

interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue>({
  openItems: new Set(),
  toggle: () => {},
});

export function Accordion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={cn("flex flex-col gap-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-[12px] bg-bg-secondary", className)}
    >
      {children}
    </div>
  );
}

export function AccordionTrigger({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { openItems, toggle } = useContext(AccordionContext);
  const isOpen = openItems.has(id);

  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-expanded={isOpen}
      aria-controls={`accordion-content-${id}`}
      className={cn(
        "flex w-full items-center justify-between px-6 py-4 text-left text-[16px] font-semibold text-primary transition-colors hover:bg-bg-elevated/50 rounded-[12px]",
        className
      )}
    >
      {children}
      <span className="ml-4 shrink-0 text-lg text-accent" aria-hidden="true">
        {isOpen ? "−" : "+"}
      </span>
    </button>
  );
}

export function AccordionContent({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { openItems } = useContext(AccordionContext);
  const isOpen = openItems.has(id);

  return (
    <div
      id={`accordion-content-${id}`}
      role="region"
      aria-labelledby={`accordion-trigger-${id}`}
      className="grid transition-all duration-300 ease-in-out"
      style={{
        gridTemplateRows: isOpen ? "1fr" : "0fr",
      }}
    >
      <div className="overflow-hidden">
        <div className={cn("px-6 pb-4 text-base leading-relaxed text-text-secondary", className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
