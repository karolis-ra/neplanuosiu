"use client";

function fitClassName(fit) {
  return fit === "contain" ? "object-contain" : "object-cover";
}

export default function ResponsiveImageFrame({
  src,
  alt = "",
  ratio = "16 / 9",
  fit = "cover",
  className = "",
  imageClassName = "",
  placeholder = "Nuotrauka ruošiama",
  children,
}) {
  return (
    <div
      className={`relative w-full overflow-hidden bg-slate-100 ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${fitClassName(fit)} ${imageClassName}`}
        />
      ) : (
        <div className="ui-font flex h-full w-full items-center justify-center px-4 text-center text-[14px] text-slate-400">
          {placeholder}
        </div>
      )}

      {children}
    </div>
  );
}
