"use client";

import { useMemo, useState } from "react";

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

  const activeImage = gallery[activeIndex] || null;

  if (!open || !service) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-[16px] py-[20px]">
      <div className="max-h-[90vh] w-full max-w-[860px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-[20px] py-[16px]">
          <div>
            <p className="ui-font text-[22px] font-semibold text-slate-900">
              {service.name}
            </p>
            <p className="ui-font mt-[4px] text-[13px] text-slate-500">
              Tiekėjas: {service.provider_name || "Nenurodytas"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-font inline-flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 text-[18px] text-slate-600 transition hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(90vh-74px)] overflow-y-auto px-[20px] py-[20px]">
          <div className="overflow-hidden rounded-[22px] bg-slate-100">
            {activeImage?.url ? (
              <img
                src={activeImage.url}
                alt={activeImage.alt || service.name}
                className="h-[280px] w-full object-cover"
              />
            ) : service.image_url ? (
              <img
                src={service.image_url}
                alt={service.image_alt || service.name}
                className="h-[280px] w-full object-cover"
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center">
                <span className="ui-font text-[14px] text-slate-400">
                  Nuotrauka ruošiama
                </span>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-[12px] flex gap-[8px] overflow-x-auto pb-[4px]">
              {gallery.map((img, index) => (
                <button
                  key={`${img.url}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-[14px] border ${
                    activeIndex === index
                      ? "border-primary"
                      : "border-slate-200"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${service.name} ${index + 1}`}
                    className="h-[68px] w-[88px] object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-[20px] grid gap-[16px]">
            <div className="rounded-[20px] bg-slate-50 p-[16px]">
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
              <div>
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Aprašymas
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.full_description || service.description}
                </p>
              </div>
            )}

            {service.includes_text && (
              <div>
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Kas įeina
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.includes_text}
                </p>
              </div>
            )}

            {service.ingredients && (
              <div>
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Sudėtis
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.ingredients}
                </p>
              </div>
            )}

            {service.notes && (
              <div>
                <h3 className="ui-font text-[15px] font-semibold text-slate-900">
                  Papildoma informacija
                </h3>
                <p className="ui-font mt-[8px] text-[14px] leading-[22px] text-slate-600">
                  {service.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-[20px] py-[16px]">
          <button
            type="button"
            onClick={() => onSelect(service)}
            className="ui-font inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
          >
            Pasirinkti paslaugą
          </button>
        </div>
      </div>
    </div>
  );
}
