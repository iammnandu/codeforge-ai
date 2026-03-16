type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
};

const SIZE_STYLES = {
  sm: {
    box: "h-7 w-7 rounded-lg",
    mark: "text-[10px]",
    text: "text-sm",
  },
  md: {
    box: "h-8 w-8 rounded-xl",
    mark: "text-[11px]",
    text: "text-base",
  },
  lg: {
    box: "h-10 w-10 rounded-xl",
    mark: "text-xs",
    text: "text-xl",
  },
};

export function BrandLogo({ size = "md", showText = true, className = "" }: BrandLogoProps) {
  const styles = SIZE_STYLES[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`relative ${styles.box} bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40 flex items-center justify-center ring-1 ring-violet-300/30`}>
        <span className={`${styles.mark} font-extrabold tracking-wide text-white`}>CF</span>
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-fuchsia-300" />
      </div>
      {showText && (
        <span className={`${styles.text} font-bold text-white tracking-tight`}>
          CodeForge <span className="text-violet-400">AI</span>
        </span>
      )}
    </div>
  );
}
