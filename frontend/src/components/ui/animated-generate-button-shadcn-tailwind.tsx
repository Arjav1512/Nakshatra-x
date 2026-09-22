"use client";

import type * as React from "react";
import clsx from "clsx";

export type AnimatedGenerateButtonProps = {
  className?: string;
  labelIdle?: string;
  labelActive?: string;
  generating?: boolean;
  highlightHueDeg?: number;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
};

export default function AnimatedGenerateButton({
  className,
  labelIdle = "Generate",
  labelActive = "Generating",
  generating = false,
  highlightHueDeg = 195,
  icon,
  active = false,
  badge,
  onClick,
  type = "button",
  disabled = false,
  id,
  ariaLabel,
}: AnimatedGenerateButtonProps) {
  return (
    <div className={clsx("relative inline-block", className)} id={id}>
      <button
        type={type}
        aria-label={ariaLabel || (generating ? labelActive : labelIdle)}
        aria-pressed={generating || active}
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          "ui-anim-btn",
          active && "ui-anim-btn-active",
          "relative flex items-center justify-center cursor-pointer select-none",
          "rounded-[24px] px-3.5 py-1.5",
          "bg-[rgba(5,11,22,0.85)] text-white",
          "border border-[rgba(56,189,248,0.3)]",
          "shadow-[inset_0px_1px_1px_rgba(255,255,255,0.25),inset_0px_2px_2px_rgba(255,255,255,0.15),inset_0px_4px_4px_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.6)]",
          "transition-[box-shadow,border,background-color] duration-400"
        )}
        style={
          {
            ["--highlight-hue" as any]: `${highlightHueDeg}deg`,
          } as React.CSSProperties
        }
      >
        {icon ? (
          <span className="ui-anim-btn-svg mr-2 flex-grow-0 transition-[fill,filter,opacity] duration-400">
            {icon}
          </span>
        ) : (
          <svg
            className={clsx(
              "ui-anim-btn-svg mr-2 h-4 w-4 flex-grow-0",
              "fill-[color:var(--ui-anim-svg-fill)]",
              "transition-[fill,filter,opacity] duration-400"
            )}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            ></path>
          </svg>
        )}

        <div className="ui-anim-txt-wrapper relative flex items-center">
          <div
            className={clsx(
              "ui-anim-txt-1 whitespace-nowrap",
              generating ? "opacity-0" : "animate-[ui-appear_1s_ease-in-out_forwards]"
            )}
          >
            {Array.from(labelIdle).map((ch, i) => (
              <span key={i} className="ui-anim-letter inline-block font-space font-bold text-[11px] md:text-[12px] tracking-[0.14em] uppercase">
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </div>
          <div
            className={clsx(
              "ui-anim-txt-2 absolute whitespace-nowrap",
              generating ? "opacity-100" : "opacity-0"
            )}
          >
            {Array.from(labelActive).map((ch, i) => (
              <span key={i} className="ui-anim-letter inline-block font-space font-bold text-[11px] md:text-[12px] tracking-[0.14em] uppercase">
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </div>
        </div>

        {badge && (
          <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[8px] font-mono font-black bg-[#00FF88]/25 text-[#00FF88] border border-[#00FF88]/60 shadow-[0_0_8px_rgba(0,255,136,0.4)] animate-pulse">
            {badge}
          </span>
        )}
      </button>

      <style jsx>{`
        .ui-anim-btn {
          --padding: 3px;
          --radius: 24px;
          --transition: 0.35s;
          --highlight: hsl(var(--highlight-hue), 100%, 70%);
          --highlight-50: hsla(var(--highlight-hue), 100%, 70%, 0.5);
          --highlight-30: hsla(var(--highlight-hue), 100%, 70%, 0.3);
          --highlight-20: hsla(var(--highlight-hue), 100%, 70%, 0.2);
          --highlight-80: hsla(var(--highlight-hue), 100%, 70%, 0.8);
          --ui-anim-svg-fill: #38bdf8;
        }

        .ui-anim-btn::before {
          content: "";
          position: absolute;
          top: calc(0px - var(--padding));
          left: calc(0px - var(--padding));
          width: calc(100% + var(--padding) * 2);
          height: calc(100% + var(--padding) * 2);
          border-radius: calc(var(--radius) + var(--padding));
          pointer-events: none;
          background-image: linear-gradient(0deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.8));
          z-index: -1;
          transition: box-shadow var(--transition), filter var(--transition);
          box-shadow:
            0 -8px 8px -6px rgba(0, 0, 0, 0) inset,
            1px 1px 1px rgba(255, 255, 255, 0.15),
            -1px -1px 1px rgba(0, 0, 0, 0.3);
        }

        .ui-anim-btn::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background-image: linear-gradient(0deg, #fff, var(--highlight), var(--highlight-50), 10%, transparent);
          background-position: 0 0;
          opacity: 0;
          transition: opacity var(--transition), filter var(--transition);
        }

        /* Active State */
        .ui-anim-btn-active {
          border-color: hsla(var(--highlight-hue), 100%, 70%, 0.8) !important;
          background-color: rgba(10, 25, 45, 0.9) !important;
          box-shadow:
            0 0 16px hsla(var(--highlight-hue), 100%, 65%, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
        }
        .ui-anim-btn-active .ui-anim-letter {
          color: #ffffff !important;
          text-shadow: 0 0 8px var(--highlight), 0 1px 3px rgba(0, 0, 0, 1) !important;
        }
        .ui-anim-btn-active .ui-anim-btn-svg {
          filter: drop-shadow(0 0 6px var(--highlight));
        }

        /* Letters */
        .ui-anim-letter {
          color: #ffffffdd;
          animation: ui-letter-anim 2.5s ease-in-out infinite;
          transition: color var(--transition), text-shadow var(--transition), opacity var(--transition);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 1);
        }

        @keyframes ui-letter-anim {
          50% {
            text-shadow: 0 0 8px hsla(var(--highlight-hue), 100%, 70%, 0.8), 0 1px 2px #000;
            color: #fff;
          }
        }

        /* SVG flicker */
        .ui-anim-btn-svg {
          filter: drop-shadow(0 0 3px var(--highlight));
          animation: ui-flicker 2.5s linear infinite;
          animation-delay: 0.5s;
        }

        @keyframes ui-flicker {
          50% {
            opacity: 0.5;
          }
        }

        /* Text layers */
        @keyframes ui-appear {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        /* Hover */
        .ui-anim-btn:hover {
          border-color: hsla(var(--highlight-hue), 100%, 80%, 0.6);
          background-color: rgba(12, 28, 50, 0.9);
        }
        .ui-anim-btn:hover::before {
          box-shadow:
            0 -8px 8px -6px rgba(255, 255, 255, 0.3) inset,
            0 -16px 16px -8px var(--highlight-30) inset,
            1px 1px 1px rgba(255, 255, 255, 0.3),
            -1px -1px 1px rgba(0, 0, 0, 0.4);
        }
        .ui-anim-btn:hover::after {
          opacity: 1;
          -webkit-mask-image: linear-gradient(0deg, #fff, transparent);
          mask-image: linear-gradient(0deg, #fff, transparent);
        }
        .ui-anim-btn:hover .ui-anim-btn-svg {
          fill: #fff;
          filter:
            drop-shadow(0 0 6px var(--highlight))
            drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.6));
          animation: none;
        }

        /* Letter stagger delays */
        .ui-anim-txt-1 .ui-anim-letter:nth-child(1),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(1) {
          animation-delay: 0s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(2),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(2) {
          animation-delay: 0.08s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(3),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(3) {
          animation-delay: 0.16s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(4),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(4) {
          animation-delay: 0.24s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(5),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(5) {
          animation-delay: 0.32s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(6),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(6) {
          animation-delay: 0.4s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(7),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(7) {
          animation-delay: 0.48s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(8),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(8) {
          animation-delay: 0.56s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(9),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(9) {
          animation-delay: 0.64s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(10),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(10) {
          animation-delay: 0.72s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(11),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(11) {
          animation-delay: 0.8s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(12),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(12) {
          animation-delay: 0.88s;
        }
        .ui-anim-txt-1 .ui-anim-letter:nth-child(13),
        .ui-anim-txt-2 .ui-anim-letter:nth-child(13) {
          animation-delay: 0.96s;
        }

        /* Disabled */
        .ui-anim-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
