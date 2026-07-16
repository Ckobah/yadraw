type YadrawLogoProps = {
  className?: string;
};

export function YadrawLogo({ className }: YadrawLogoProps) {
  const classes = ["yadrawLogo", className].filter(Boolean).join(" ");

  return (
    <span className={classes} role="img" aria-label="Yadraw">
      <img
        src="/yadraw-logo.svg"
        alt=""
        aria-hidden="true"
        width="1402"
        height="500"
      />
    </span>
  );
}
