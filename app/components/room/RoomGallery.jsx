"use client";

import { useState } from "react";

export default function RoomGallery({ images = [], roomName }) {
  const [current, setCurrent] = useState(0);

  if (!images.length) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-dark text-white">
        Nuotrauka netrukus
      </div>
    );
  }

  const next = () => setCurrent((prev) => (prev + 1) % images.length);
  const prev = () =>
    setCurrent((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className="w-full">
      {/* MAIN IMAGE SLIDER */}
      <div className="relative h-[360px] w-full overflow-hidden rounded-3xl bg-slate-200">
        {/* Left arrow */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
        >
          ‹
        </button>

        {/* Right arrow */}
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
        >
          ›
        </button>

        {/* BIG IMAGE */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt={roomName}
          className="h-full w-full object-cover"
        />
      </div>

      {/* THUMBNAILS */}
      <div className="mt-4 flex justify-center gap-3">
        {images.map((img, index) => (
          <div
            key={index}
            onClick={() => setCurrent(index)}
            className={`cursor-pointer overflow-hidden rounded-xl border-2 transition
              ${
                current === index
                  ? "border-primary"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="h-16 w-20 object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
