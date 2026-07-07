export function LoaderIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      preserveAspectRatio="xMidYMid"
    >
      <circle
        cx="50"
        cy="50"
        r="32"
        strokeWidth="8"
        stroke="currentColor"
        strokeDasharray="50.26548245743669 50.26548245743669"
        fill="none"
        strokeLinecap="round"
        className="opacity-20"
      />
      <circle
        cx="50"
        cy="50"
        r="32"
        strokeWidth="8"
        stroke="currentColor"
        strokeDasharray="50.26548245743669 50.26548245743669"
        fill="none"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          repeatCount="indefinite"
          dur="1s"
          keyTimes="0;1"
          values="0 50 50;360 50 50"
        />
      </circle>
      <circle
        cx="50"
        cy="50"
        r="14"
        fill="currentColor"
      >
        <animate
          attributeName="opacity"
          repeatCount="indefinite"
          dur="2s"
          values="0.2;1;0.2"
        />
      </circle>
    </svg>
  );
}
