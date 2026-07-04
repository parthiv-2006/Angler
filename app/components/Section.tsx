"use client";

import type { ReactNode, Ref } from "react";
import { headerRule, sectionTitle, sectionMeta, watermark } from "./theme";

// Shared shell for the four numbered sections: translucent "Nº" watermark,
// mono-caps header rule with meta text and an optional right-aligned action.
export default function Section({
  num,
  id,
  innerRef,
  title,
  meta,
  action,
  children,
  padding = "30px 32px 50px",
}: {
  num: string;
  id: string;
  innerRef?: Ref<HTMLElement>;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padding?: string;
}) {
  return (
    <section
      id={id}
      ref={innerRef}
      style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding, animation: "rise 0.6s ease both" }}
    >
      <span style={watermark}>{num}</span>
      <div style={{ position: "relative" }}>
        <div style={headerRule}>
          <span style={sectionTitle}>{title}</span>
          {meta && <span style={sectionMeta}>{meta}</span>}
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}
