"use client";

import { useState } from "react";
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
