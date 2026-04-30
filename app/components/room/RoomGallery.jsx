"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ResponsiveImageFrame from "../ResponsiveImageFrame";

export default function RoomGallery({ images = [], roomName }) {
  const [current, setCurrent] = useState(0);

  if (!images.length) {
    return (
      <ResponsiveImageFrame
        ratio="16 / 9"
        className="rounded-3xl"
        placeholder="Nuotrauka netrukus"
      />
    );
  }

  const next = () => setCurrent((prev) => (prev + 1) % images.length);
  const prev = () =>
    setCurrent((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="w-full">
      {/* MAIN IMAGE SLIDER */}
      <ResponsiveImageFrame
        src={images[current]}
        alt={roomName}
        ratio="16 / 9"
        className="rounded-3xl"
      >
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-4 top-1/2 flex h-[48px] w-[48px] -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-primary shadow-lg shadow-slate-900/20 backdrop-blur transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-white/50"
              aria-label="Ankstesnė nuotrauka"
            >
              <ChevronLeft size={28} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              onClick={next}
              className="absolute right-4 top-1/2 flex h-[48px] w-[48px] -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-primary shadow-lg shadow-slate-900/20 backdrop-blur transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-4 focus:ring-white/50"
              aria-label="Kita nuotrauka"
            >
              <ChevronRight size={28} strokeWidth={2.4} />
            </button>
          </>
        )}
      </ResponsiveImageFrame>

      {/* THUMBNAILS */}
      <div className="mt-4 flex justify-center gap-3">
        {images.map((img, index) => (
          <button
            type="button"
            key={index}
            onClick={() => setCurrent(index)}
            className={`overflow-hidden rounded-xl border-2 transition
              ${
                current === index
                  ? "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
          >
            <ResponsiveImageFrame
              src={img}
              alt=""
              ratio="5 / 4"
              className="h-16 w-20"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
