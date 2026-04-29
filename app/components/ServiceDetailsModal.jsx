"use client";

import { useMemo, useState } from "react";
import ResponsiveImageFrame from "./ResponsiveImageFrame";

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function ServiceDetailsModal({
  open,
  service,
  onClose,
  onSelect,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const gallery = useMemo(() => {
    if (!service?.images || !service.images.length) return [];
    return service.images;
  }, [service]);

  const safeActiveIndex =
    gallery.length > 0 ? Math.min(activeIndex, gallery.length - 1) : 0;
  const activeImage = gallery[safeActiveIndex] || null;

  if (!open || !service) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-[16px] py-[20px]">
      <div className="max-h-[88vh] w-full max-w-[720px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-[18px] border-b border-slate-200 px-[28px] py-[22px]">
          <div>
            <p className="ui-font text-[22px] font-semibold leading-[30px] text-slate-900">
              {service.name}
            </p>
            <p className="ui-font mt-[4px] text-[13px] text-slate-500">
              Tiekėjas: {service.provider_name || "Nenurodytas"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-font inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-slate-200 text-[18px] text-slate-600 transition hover:bg-slate-50"
            aria-label="Uždaryti"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(88vh-90px)] overflow-y-auto px-[28px] py-[24px]">
          <ResponsiveImageFrame
            src={activeImage?.url || service.image_url}
            alt={activeImage?.alt || service.image_alt || service.name}
            ratio="16 / 7"
            fit="contain"
            className="rounded-[22px]"
          />

          {gallery.length > 1 && (
            <div className="mt-[12px] flex gap-[8px] overflow-x-auto pb-[4px]">
              {gallery.map((img, index) => (
                <button
                  key={`${img.url}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-[14px] border ${
                    safeActiveIndex === index
                      ? "border-primary"
                      : "border-slate-200"
                  }`}
                >
                  <ResponsiveImageFrame
                    src={img.url}
                    alt={img.alt || `${service.name} ${index + 1}`}
                    ratio="22 / 17"
                    className="h-[68px] w-[88px]"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-[24px] grid gap-[18px]">
            <div className="rounded-[20px] bg-slate-50 p-[18px]">
              <div className="flex items-center justify-between gap-[12px]">
                <span className="ui-font text-[14px] text-slate-500">
                  Kaina
                </span>
                <span className="ui-font text-[26px] font-semibold text-primary">
                  {formatPrice(service.price_per_unit)}
                </span>
              </div>
            </div>

            {(service.full_description || service.description) && (
              <section className="rounded-[20px] border border-slate-100 p-[18px]">
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Aprašymas
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.full_description || service.description}
                </p>
              </section>
            )}

            {service.includes_text && (
              <section className="rounded-[20px] border border-slate-100 p-[18px]">
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Kas įeina
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.includes_text}
                </p>
              </section>
            )}

            {service.ingredients && (
              <section className="rounded-[20px] border border-slate-100 p-[18px]">
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Sudėtis
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.ingredients}
                </p>
              </section>
            )}

            {service.notes && (
              <section className="rounded-[20px] border border-slate-100 p-[18px]">
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Papildoma informacija
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.notes}
                </p>
              </section>
            )}
          </div>

          <div className="mt-[24px] grid gap-[10px] border-t border-slate-200 pt-[18px] sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSelect(service)}
              className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
            >
              Rezervuoti
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Uždaryti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
