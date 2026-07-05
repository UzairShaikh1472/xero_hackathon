import { cn } from "@/lib/utils";

export function UpFlowLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="16" fill="#151515" />
      <text
        x="8"
        y="21.5"
        fontSize="14.5"
        fontWeight="700"
        fill="#b8ff36"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        {"\u00A3"}
      </text>
      <path
        d="M21 16H25.6M23.25 13.75L25.9 16L23.25 18.25"
        stroke="#b8ff36"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UpFlowBrand({
  size = 32,
  textClassName,
  className,
}: {
  size?: number;
  textClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <UpFlowLogo size={size} />
      <span className={cn("font-sans font-semibold tracking-tight text-foreground", textClassName)}>
        UpFlow
      </span>
    </div>
  );
}
