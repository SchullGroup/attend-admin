import { LoaderIcon } from "./LoaderIcon";

interface LoaderProps {
  variant?: "page" | "overlay" | "inline";
  text?: string;
}

export function Loader({ variant = "page", text = "Loading..." }: LoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground justify-center p-4">
        <LoaderIcon className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">{text}</span>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
        <LoaderIcon className="w-16 h-16 text-primary mb-4 drop-shadow-md" />
        <p className="text-lg font-semibold text-foreground animate-pulse">
          {text}
        </p>
      </div>
    );
  }

  // page variant
  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center">
      <LoaderIcon className="w-16 h-16 text-primary mb-4 drop-shadow-md" />
      <p className="text-lg font-semibold text-muted-foreground animate-pulse">
        {text}
      </p>
    </div>
  );
}
