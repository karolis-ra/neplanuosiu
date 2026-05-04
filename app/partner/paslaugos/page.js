"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { mapServiceImagesWithUrls } from "../../lib/serviceImageUtils";
import ResponsiveImageFrame from "../../components/ResponsiveImageFrame";
import Loader from "../../components/Loader";
import ConfirmModal from "../../components/ConfirmModal";
import SelectControl from "../../components/SelectControl";
import DatePickerControl from "../../components/DatePickerControl";
import TimeSelectControl from "../../components/TimeSelectControl";

const BUCKET = "public-images";

const SERVICE_TYPES = [
  { value: "decorations", label: "Dekoracijos" },
  { value: "animator", label: "Animatorius" },
  { value: "cake", label: "Tortas" },
];

const UNIT_OPTIONS = [
  { value: "unit", label: "vnt." },
  { value: "hour", label: "val." },
  { value: "booking", label: "už rezervaciją" },
  { value: "child", label: "vaikui" },
  { value: "adult", label: "suaugusiajam" },
];

const SERVICE_TYPES_WITH_DURATION = ["animator"];

const EMPTY_EDIT_FORM = {
  id: "",
  name: "",
  serviceType: "decorations",
  pricePerUnit: "",
  unitsOfMeasure: "unit",
  durationMinutes: "",
  isListed: true,
  isGlobal: false,
  shortDescription: "",
  fullDescription: "",
  includesText: "",
  ingredients: "",
  notes: "",
};

const EMPTY_PROVIDER_FORM = {
  name: "",
  description: "",
  address: "",
  city: "",
  email: "",
  phone: "",
  website: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  googleMapsUrl: "",
};

function formatPrice(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} €`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isMissingRelationError(error) {
  return error?.code === "42P01";
}

function getServiceTypeLabel(type) {
  switch (type) {
    case "animator":
      return "Animatorius";
    case "cake":
      return "Tortas";
    case "decorations":
      return "Dekoracijos";
    default:
      return type || "Nenurodyta";
  }
}

function getUnitLabel(unit) {
  switch (unit) {
    case "unit":
      return "vnt.";
    case "hour":
      return "val.";
    case "booking":
      return "už rezervaciją";
    case "child":
      return "vaikui";
    case "adult":
      return "suaugusiajam";
    default:
      return unit || "";
  }
}

function getServiceScope(service) {
  if (service?.room_id) {
    return {
      label: "Priskirta kambariui",
      value: service.room?.name || "Kambarys",
    };
  }

  if (service?.venue_id && !service?.is_global) {
    return {
      label: "Priskirta erdvei",
      value: service.venue?.name || "Erdvė",
    };
  }

  return {
    label: "Matomumas",
    value: "Bendras katalogas",
  };
}

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

function ServiceImageCarousel({ images = [], name }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || null;

  if (!images.length) {
    return (
      <ResponsiveImageFrame
        ratio="16 / 9"
        className="mb-[16px] rounded-[20px]"
      />
    );
  }

  return (
    <div className="mb-[16px]">
      <ResponsiveImageFrame
        src={activeImage.imageUrl}
        alt={activeImage.alt_text || name}
        ratio="16 / 9"
        className="rounded-[20px]"
      >
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((current) =>
                  current === 0 ? images.length - 1 : current - 1,
                )
              }
              className="ui-font absolute left-[10px] top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[18px] font-semibold text-slate-800 shadow-sm"
              aria-label="Ankstesnė nuotrauka"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((current) => (current + 1) % images.length)
              }
              className="ui-font absolute right-[10px] top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[18px] font-semibold text-slate-800 shadow-sm"
              aria-label="Kita nuotrauka"
            >
              ›
            </button>
          </>
        )}
      </ResponsiveImageFrame>

      {images.length > 1 && (
        <div className="mt-[10px] flex gap-[8px] overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-[52px] w-[72px] shrink-0 overflow-hidden rounded-[12px] border ${
                activeIndex === index ? "border-primary" : "border-slate-200"
              }`}
              aria-label={`Rodyti ${index + 1} nuotrauką`}
            >
              <ResponsiveImageFrame
                src={image.imageUrl}
                alt={image.alt_text || name}
                ratio="18 / 13"
                className="h-[52px] w-[72px]"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceBlockModal({
  service,
  form,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  if (!service) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 px-[16px] py-[24px]">
      <section className="w-full max-w-[520px] rounded-[28px] bg-white p-[22px] shadow-xl">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
              Užimtas laikas
            </p>
            <h2 className="mt-[6px] ui-font text-[24px] font-semibold text-slate-900">
              {service.name}
            </h2>
            <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
              Pažymėkite laiką, kai ši paslauga užimta už platformos ribų.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-font flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] text-slate-600 transition hover:bg-slate-50"
            aria-label="Uždaryti"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mt-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px] ui-font text-[14px] text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-[18px] space-y-[14px]">
          <label className="block">
            <span className="ui-font text-[13px] font-semibold text-slate-600">
              Data
            </span>
            <DatePickerControl
              value={form.date}
              onChange={(nextValue) => onChange("date", nextValue)}
              placeholder="Pasirinkite datą"
              className="mt-[6px]"
            />
          </label>

          <div className="grid gap-[12px] sm:grid-cols-2">
            <label className="block">
              <span className="ui-font text-[13px] font-semibold text-slate-600">
                Nuo
              </span>
              <TimeSelectControl
                value={form.startTime}
                onChange={(nextValue) => onChange("startTime", nextValue)}
                placeholder="Pradžios laikas"
                className="mt-[6px]"
              />
            </label>

            <label className="block">
              <span className="ui-font text-[13px] font-semibold text-slate-600">
                Iki
              </span>
              <TimeSelectControl
                value={form.endTime}
                onChange={(nextValue) => onChange("endTime", nextValue)}
                placeholder="Pabaigos laikas"
                className="mt-[6px]"
              />
            </label>
          </div>

          <div className="rounded-[18px] bg-slate-50 px-[14px] py-[12px]">
            <p className="ui-font text-[13px] leading-[20px] text-slate-500">
              Šiuo laiku klientai nebegalės pasirinkti šios paslaugos, jei
              rezervacijos laikas persidengs su pažymėtu užimtumu.
            </p>
          </div>

          <div className="flex flex-col gap-[10px] sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Atšaukti
            </button>
            <button
              type="submit"
              disabled={saving}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saugoma..." : "Pažymėti kaip užimtą"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function PartnerServicesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [deletingServiceId, setDeletingServiceId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [deleteProviderModalOpen, setDeleteProviderModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editPhotoFiles, setEditPhotoFiles] = useState([]);
  const [savingService, setSavingService] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER_FORM);
  const [savingProvider, setSavingProvider] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [blockingService, setBlockingService] = useState(null);
  const [blockForm, setBlockForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });
  const [blockError, setBlockError] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  const showsEditDurationField = SERVICE_TYPES_WITH_DURATION.includes(
    editForm.serviceType,
  );

  const editPhotoPreviews = useMemo(
    () =>
      editPhotoFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [editPhotoFiles],
  );

  useEffect(() => {
    return () => {
      editPhotoPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [editPhotoPreviews]);

  useEffect(() => {
    let isMounted = true;

    async function loadProviderData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (authError) {
          console.error("auth error:", authError.message);
        }

        if (!user) {
          router.replace("/prisijungti");
          return;
        }

        const { data: providerRow, error: providerError } = await supabase
          .from("service_providers")
          .select(
            "id, name, description, address, city, email, phone, website, facebook_url, instagram_url, tiktok_url, google_maps_url",
          )
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (providerError) {
          throw providerError;
        }

        if (!providerRow) {
          router.replace("/partner/onboarding/paslaugos");
          return;
        }

        setProvider(providerRow);

        const { data: serviceRows, error: servicesError } = await supabase
          .from("services")
          .select(
            `
            id,
            name,
            description,
            price_per_unit,
            units_of_measure,
            duration_minutes,
            is_listed,
            service_type,
            is_global,
            short_description,
            full_description,
            ingredients,
            includes_text,
            notes,
            venue_id,
            room_id,
            sort_order,
            room:rooms (
              id,
              name
            ),
            venue:venues (
              id,
              name
            )
          `,
          )
          .eq("provider_id", providerRow.id)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (servicesError) {
          throw servicesError;
        }

        const serviceIds = (serviceRows || []).map((service) => service.id);
        let imagesByServiceId = new Map();

        if (serviceIds.length) {
          const { data: imageRows, error: imagesError } = await supabase
            .from("service_images")
            .select("id, service_id, path, alt_text, is_primary, position")
            .in("service_id", serviceIds)
            .order("position", { ascending: true });

          if (imagesError) throw imagesError;

          const mappedImages = mapServiceImagesWithUrls({
            supabase,
            images: imageRows || [],
          });

          imagesByServiceId = mappedImages.reduce((acc, image) => {
            if (!acc.has(image.service_id)) {
              acc.set(image.service_id, []);
            }
            acc.get(image.service_id).push(image);
            return acc;
          }, new Map());
        }

        setServices(
          (serviceRows || []).map((service) => ({
            ...service,
            images: imagesByServiceId.get(service.id) || [],
          })),
        );
      } catch (error) {
        console.error("partner services load error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko užkrauti paslaugų informacijos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProviderData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  function openBlockModal(service) {
    setBlockingService(service);
    setBlockForm({
      date: "",
      startTime: "",
      endTime: "",
    });
    setBlockError("");
  }

  function closeBlockModal() {
    if (savingBlock) return;
    setBlockingService(null);
    setBlockError("");
  }

  function updateBlockForm(field, value) {
    setBlockForm((current) => ({
      ...current,
      [field]: value,
    }));
    setBlockError("");
  }

  async function handleCreateServiceBlock(event) {
    event.preventDefault();

    if (!blockingService) return;

    const start = timeToMinutes(blockForm.startTime);
    const end = timeToMinutes(blockForm.endTime);

    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) {
      setBlockError("Užpildykite datą, pradžios ir pabaigos laiką.");
      return;
    }

    if (end <= start) {
      setBlockError("Pabaigos laikas turi būti vėlesnis už pradžios laiką.");
      return;
    }

    try {
      setSavingBlock(true);
      setBlockError("");
      setErrorMsg("");
      setSuccessMsg("");

      const [blocksRes, bookingServicesRes] = await Promise.all([
        supabase
          .from("service_unavailability")
          .select("id, start_time, end_time")
          .eq("service_id", blockingService.id)
          .eq("date", blockForm.date),
        supabase
          .from("booking_services")
          .select(
            `
            id,
            start_time,
            end_time,
            booking:bookings!booking_services_booking_id_fkey (
              event_date,
              status
            )
          `,
          )
          .eq("service_id", blockingService.id),
      ]);

      if (blocksRes.error) throw blocksRes.error;
      if (bookingServicesRes.error) throw bookingServicesRes.error;

      const existingBusyIntervals = [
        ...(blocksRes.data || []),
        ...(bookingServicesRes.data || []).filter((item) => {
          const booking = item.booking;
          if (!booking || booking.event_date !== blockForm.date) return false;
          return booking.status !== "cancelled" && booking.status !== "rejected";
        }),
      ];

      const hasConflict = existingBusyIntervals.some((item) =>
        rangesOverlap(
          start,
          end,
          timeToMinutes(item.start_time),
          timeToMinutes(item.end_time),
        ),
      );

      if (hasConflict) {
        setBlockError("Pasirinktas laikas jau persidengia su kitu užimtumu.");
        return;
      }

      const { error: insertError } = await supabase
        .from("service_unavailability")
        .insert({
          service_id: blockingService.id,
          date: blockForm.date,
          start_time: blockForm.startTime,
          end_time: blockForm.endTime,
        });

      if (insertError) throw insertError;

      setBlockingService(null);
      setBlockError("");
      setSuccessMsg("Paslaugos laikas užblokuotas.");
    } catch (error) {
      console.error("service block insert error:", error);
      setBlockError("Nepavyko pažymėti užimto laiko. Bandykite dar kartą.");
    } finally {
      setSavingBlock(false);
    }
  }

  function openProviderModal() {
    if (!provider) return;

    setProviderForm({
      name: provider.name || "",
      description: provider.description || "",
      address: provider.address || "",
      city: provider.city || "",
      email: provider.email || "",
      phone: provider.phone || "",
      website: provider.website || "",
      facebookUrl: provider.facebook_url || "",
      instagramUrl: provider.instagram_url || "",
      tiktokUrl: provider.tiktok_url || "",
      googleMapsUrl: provider.google_maps_url || "",
    });
    setEditingProvider(true);
  }

  function closeProviderModal() {
    setEditingProvider(false);
    setProviderForm(EMPTY_PROVIDER_FORM);
  }

  function updateProviderForm(field, value) {
    setProviderForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveProvider(e) {
    e.preventDefault();
    if (!provider?.id) return;

    setSavingProvider(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        name: providerForm.name.trim() || null,
        description: providerForm.description.trim() || null,
        address: providerForm.address.trim() || null,
        city: providerForm.city.trim() || null,
        email: providerForm.email.trim() || null,
        phone: providerForm.phone.trim() || null,
        website: providerForm.website.trim() || null,
        facebook_url: providerForm.facebookUrl.trim() || null,
        instagram_url: providerForm.instagramUrl.trim() || null,
        tiktok_url: providerForm.tiktokUrl.trim() || null,
        google_maps_url: providerForm.googleMapsUrl.trim() || null,
      };

      const { error } = await supabase
        .from("service_providers")
        .update(payload)
        .eq("id", provider.id);

      if (error) throw error;

      setProvider((current) => ({ ...current, ...payload }));
      setSuccessMsg("Paslaugų profilis atnaujintas.");
      closeProviderModal();
    } catch (error) {
      console.error("save provider profile error:", error);
      setErrorMsg("Nepavyko išsaugoti paslaugų profilio pakeitimų.");
    } finally {
      setSavingProvider(false);
    }
  }

  function openEditModal(service) {
    setEditingService(service);
    setEditPhotoFiles([]);
    setEditForm({
      id: service.id,
      name: service.name || "",
      serviceType: service.service_type || "decorations",
      pricePerUnit: String(service.price_per_unit ?? ""),
      unitsOfMeasure: service.units_of_measure || "unit",
      durationMinutes:
        service.duration_minutes == null
          ? ""
          : String(service.duration_minutes),
      isListed: service.is_listed !== false,
      isGlobal: Boolean(service.is_global),
      shortDescription: service.short_description || "",
      fullDescription: service.full_description || "",
      includesText: service.includes_text || "",
      ingredients: service.ingredients || "",
      notes: service.notes || "",
    });
  }

  function closeEditModal() {
    setEditingService(null);
    setEditForm(EMPTY_EDIT_FORM);
    setEditPhotoFiles([]);
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "serviceType" &&
      !SERVICE_TYPES_WITH_DURATION.includes(value)
        ? { durationMinutes: "" }
        : {}),
    }));
  }

  async function handleDeleteServiceImage(image) {
    if (!editingService || !image?.id) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error: deleteError } = await supabase
        .from("service_images")
        .delete()
        .eq("id", image.id);

      if (deleteError) throw deleteError;

      if (image.path) {
        await supabase.storage.from(BUCKET).remove([image.path]);
      }

      setServices((current) =>
        current.map((service) =>
          service.id === editingService.id
            ? {
                ...service,
                images: (service.images || []).filter(
                  (item) => item.id !== image.id,
                ),
              }
            : service,
        ),
      );

      setEditingService((current) =>
        current
          ? {
              ...current,
              images: (current.images || []).filter(
                (item) => item.id !== image.id,
              ),
            }
          : current,
      );
    } catch (error) {
      console.error("delete service image error:", error);
      setErrorMsg("Nepavyko ištrinti paslaugos nuotraukos.");
    }
  }

  async function handleSaveService(e) {
    e.preventDefault();
    if (!editingService || !provider?.id) return;

    setSavingService(true);
    setErrorMsg("");
    setSuccessMsg("");

    const uploadedPaths = [];

    try {
      const payload = {
        name: editForm.name.trim() || null,
        description:
          editForm.fullDescription.trim() ||
          editForm.shortDescription.trim() ||
          null,
        short_description: editForm.shortDescription.trim() || null,
        full_description: editForm.fullDescription.trim() || null,
        includes_text: editForm.includesText.trim() || null,
        ingredients:
          editForm.serviceType === "cake"
            ? editForm.ingredients.trim() || null
            : null,
        notes: editForm.notes.trim() || null,
        service_type: editForm.serviceType,
        price_per_unit:
          editForm.pricePerUnit === "" ? null : Number(editForm.pricePerUnit),
        units_of_measure: editForm.unitsOfMeasure,
        duration_minutes: showsEditDurationField
          ? editForm.durationMinutes === ""
            ? null
            : Number(editForm.durationMinutes)
          : null,
        is_listed: editForm.isListed,
        is_global: editForm.isGlobal,
      };

      const { error: updateError } = await supabase
        .from("services")
        .update(payload)
        .eq("id", editingService.id);

      if (updateError) throw updateError;

      const existingImageCount = editingService.images?.length || 0;

      for (let index = 0; index < editPhotoFiles.length; index += 1) {
        const file = editPhotoFiles[index];
        const path = `services/${provider.id}/${editingService.id}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedPaths.push(path);
      }

      let insertedImages = [];

      if (uploadedPaths.length) {
        const imageRows = uploadedPaths.map((path, index) => ({
          service_id: editingService.id,
          path,
          alt_text: editForm.name.trim() || null,
          is_primary: existingImageCount === 0 && index === 0,
          position: existingImageCount + index,
        }));

        const { data: insertedRows, error: imageInsertError } = await supabase
          .from("service_images")
          .insert(imageRows)
          .select("id, service_id, path, alt_text, is_primary, position");

        if (imageInsertError) throw imageInsertError;

        insertedImages = mapServiceImagesWithUrls({
          supabase,
          images: insertedRows || [],
        });
      }

      const updatedService = {
        ...editingService,
        ...payload,
        images: [...(editingService.images || []), ...insertedImages],
      };

      setServices((current) =>
        current.map((service) =>
          service.id === editingService.id ? updatedService : service,
        ),
      );
      setEditingService(updatedService);
      setEditPhotoFiles([]);
      setSuccessMsg("Paslauga atnaujinta.");
    } catch (error) {
      console.error("save service error:", error);
      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
      }
      setErrorMsg("Nepavyko išsaugoti paslaugos pakeitimų.");
    } finally {
      setSavingService(false);
    }
  }

  async function handleDeleteService() {
    if (!serviceToDelete) {
      return;
    }

    setDeletingServiceId(serviceToDelete.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: serviceImageRows, error: serviceImagesLoadError } =
        await supabase
          .from("service_images")
          .select("path")
          .eq("service_id", serviceToDelete.id);

      if (serviceImagesLoadError) throw serviceImagesLoadError;

      const { error: bookingApprovalsError } = await supabase
        .from("booking_approvals")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (bookingApprovalsError) throw bookingApprovalsError;

      const { error: bookingServicesError } = await supabase
        .from("booking_services")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (bookingServicesError) throw bookingServicesError;

      const { error: serviceUnavailabilityError } = await supabase
        .from("service_unavailability")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (
        serviceUnavailabilityError &&
        !isMissingRelationError(serviceUnavailabilityError)
      ) {
        throw serviceUnavailabilityError;
      }

      const { error: serviceImagesDeleteError } = await supabase
        .from("service_images")
        .delete()
        .eq("service_id", serviceToDelete.id);

      if (serviceImagesDeleteError) throw serviceImagesDeleteError;

      const { error: serviceDeleteError } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceToDelete.id);

      if (serviceDeleteError) throw serviceDeleteError;

      const storagePaths = (serviceImageRows || [])
        .map((item) => item.path)
        .filter(Boolean);

      if (storagePaths.length) {
        await supabase.storage.from(BUCKET).remove(storagePaths);
      }

      setServices((current) =>
        current.filter((item) => item.id !== serviceToDelete.id),
      );
      setSuccessMsg("Paslauga ištrinta.");
      setServiceToDelete(null);
    } catch (error) {
      console.error("delete service error:", error);
      setErrorMsg(
        "Nepavyko ištrinti paslaugos. Gali būti, kad jai vis dar yra susietų rezervacijų arba trūksta DB leidimų.",
      );
    } finally {
      setDeletingServiceId("");
    }
  }

  async function handleDeleteProviderProfile() {
    if (!provider?.id) {
      return;
    }

    setDeletingProvider(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const serviceIds = services.map((service) => service.id).filter(Boolean);
      let storagePaths = [];

      if (serviceIds.length) {
        const { data: serviceImageRows, error: serviceImagesLoadError } =
          await supabase
            .from("service_images")
            .select("path")
            .in("service_id", serviceIds);

        if (serviceImagesLoadError) throw serviceImagesLoadError;

        storagePaths = (serviceImageRows || [])
          .map((item) => item.path)
          .filter(Boolean);

        const { error: bookingApprovalsByServiceError } = await supabase
          .from("booking_approvals")
          .delete()
          .in("service_id", serviceIds);

        if (bookingApprovalsByServiceError) {
          throw bookingApprovalsByServiceError;
        }

        const { error: bookingServicesError } = await supabase
          .from("booking_services")
          .delete()
          .in("service_id", serviceIds);

        if (bookingServicesError) throw bookingServicesError;

        const { error: serviceUnavailabilityError } = await supabase
          .from("service_unavailability")
          .delete()
          .in("service_id", serviceIds);

        if (
          serviceUnavailabilityError &&
          !isMissingRelationError(serviceUnavailabilityError)
        ) {
          throw serviceUnavailabilityError;
        }

        const { error: serviceImagesDeleteError } = await supabase
          .from("service_images")
          .delete()
          .in("service_id", serviceIds);

        if (serviceImagesDeleteError) throw serviceImagesDeleteError;

        const { error: servicesDeleteError } = await supabase
          .from("services")
          .delete()
          .in("id", serviceIds);

        if (servicesDeleteError) throw servicesDeleteError;
      }

      const { error: bookingApprovalsByProviderError } = await supabase
        .from("booking_approvals")
        .delete()
        .eq("provider_id", provider.id);

      if (bookingApprovalsByProviderError) {
        throw bookingApprovalsByProviderError;
      }

      const { error: providerAvailabilityError } = await supabase
        .from("service_provider_availability")
        .delete()
        .eq("provider_id", provider.id);

      if (
        providerAvailabilityError &&
        !isMissingRelationError(providerAvailabilityError)
      ) {
        throw providerAvailabilityError;
      }

      const { error: providerUnavailabilityError } = await supabase
        .from("service_provider_unavailability")
        .delete()
        .eq("provider_id", provider.id);

      if (
        providerUnavailabilityError &&
        !isMissingRelationError(providerUnavailabilityError)
      ) {
        throw providerUnavailabilityError;
      }

      const { error: providerDeleteError } = await supabase
        .from("service_providers")
        .delete()
        .eq("id", provider.id);

      if (providerDeleteError) throw providerDeleteError;

      if (storagePaths.length) {
        await supabase.storage.from(BUCKET).remove(storagePaths);
      }

      setProvider(null);
      setServices([]);
      setDeleteProviderModalOpen(false);
      setSuccessMsg("Paslaugų profilis ištrintas.");
      router.replace("/partner");
    } catch (error) {
      console.error("delete service provider profile error:", error);
      setErrorMsg(
        "Nepavyko ištrinti paslaugų profilio. Gali būti, kad profiliui vis dar yra susietų rezervacijų arba trūksta duomenų bazės leidimų.",
      );
    } finally {
      setDeletingProvider(false);
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1200px] px-[16px] py-[40px]">
      <div className="mb-[28px] flex flex-col gap-[16px] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Paslaugų valdymas
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Mano paslaugos
          </h1>
          <p className="mt-[12px] ui-font text-[15px] leading-[24px] text-slate-600">
            Čia valdysite paslaugų profilį ir savo siūlomas paslaugas.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            provider && router.push(`/partner/paslaugos/${provider.id}/nauja`)
          }
          className="ui-font inline-flex h-[50px] items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark"
        >
          Pridėti naują paslaugą
        </button>
      </div>

      {errorMsg && (
        <div className="mb-[20px] rounded-[18px] bg-red-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-[20px] rounded-[18px] bg-emerald-50 px-[16px] py-[12px]">
          <p className="ui-font text-[14px] text-emerald-700">{successMsg}</p>
        </div>
      )}

      {provider && (
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="flex flex-col gap-[16px] md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="ui-font text-[24px] font-semibold text-slate-900">
                {provider.name}
              </h2>

              {(provider.address || provider.city) && (
                <p className="mt-[8px] ui-font text-[14px] text-slate-500">
                  {provider.address || ""}
                  {provider.address && provider.city ? ", " : ""}
                  {provider.city || ""}
                </p>
              )}

              {provider.description && (
                <p className="mt-[12px] ui-font max-w-[760px] text-[14px] leading-[22px] text-slate-600">
                  {provider.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-[20px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">El. paštas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {provider.email || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Telefonas</p>
              <p className="mt-[4px] ui-font text-[14px] font-semibold text-slate-800">
                {provider.phone || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Svetainė</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.website || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Facebook</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.facebook_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">Instagram</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.instagram_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px]">
              <p className="ui-font text-[12px] text-slate-500">TikTok</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.tiktok_url || "-"}
              </p>
            </div>

            <div className="rounded-[20px] bg-slate-50 p-[14px] md:col-span-2 xl:col-span-3">
              <p className="ui-font text-[12px] text-slate-500">Google Maps</p>
              <p className="mt-[4px] ui-font break-all text-[14px] font-semibold text-slate-800">
                {provider.google_maps_url || "-"}
              </p>
            </div>
          </div>

          <div className="mt-[20px] flex flex-col gap-[10px] sm:flex-row">
            <button
              type="button"
              onClick={openProviderModal}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white shadow-md transition hover:bg-dark"
            >
              Valdyti paslaugų profilį
            </button>

            <button
              type="button"
              onClick={() => router.push("/partner/paslaugu-užklausos")}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white shadow-md transition hover:bg-dark"
            >
              Peržiūrėti paslaugų užklausas
            </button>

            <button
              type="button"
              onClick={() => setDeleteProviderModalOpen(true)}
              disabled={deletingProvider}
              className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-red-200 bg-red-50 px-[16px] text-[14px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingProvider ? "Trinama..." : "Ištrinti paslaugų profilį"}
            </button>
          </div>
        </section>
      )}

      <section className="mt-[24px]">
        <div className="mb-[16px] flex items-center justify-between">
          <h2 className="ui-font text-[24px] font-semibold text-slate-900">
            Paslaugos
          </h2>
          <span className="ui-font text-[14px] text-slate-500">
            Iš viso: {services.length}
          </span>
        </div>

        {services.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-[24px] py-[32px] text-center">
            <p className="ui-font text-[16px] font-semibold text-slate-800">
              Paslaugų dar nėra
            </p>
            <p className="mt-[8px] ui-font text-[14px] text-slate-500">
              Sukurkite pirmą arba papildomą paslaugą savo profiliui.
            </p>

            <button
              type="button"
              onClick={() =>
                provider &&
                router.push(`/partner/paslaugos/${provider.id}/nauja`)
              }
              className="ui-font mt-[16px] inline-flex h-[48px] items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark"
            >
              Pridėti paslaugą
            </button>
          </div>
        ) : (
          <div className="grid gap-[16px] lg:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.id}
                className="rounded-[24px] bg-white p-[20px] shadow-sm"
              >
                <ServiceImageCarousel
                  images={service.images || []}
                  name={service.name}
                />

                <div className="flex items-start justify-between gap-[12px]">
                  <div>
                    <h3 className="ui-font text-[20px] font-semibold text-slate-900">
                      {service.name}
                    </h3>

                    {service.short_description && (
                      <p className="mt-[8px] ui-font text-[14px] leading-[22px] text-slate-600">
                        {service.short_description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-[18px] grid gap-[10px] sm:grid-cols-2">
                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Tipas</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {getServiceTypeLabel(service.service_type)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Kaina</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {formatPrice(service.price_per_unit)}{" "}
                      {getUnitLabel(service.units_of_measure)}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">Trukmė</p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {service.duration_minutes
                        ? `${service.duration_minutes} min.`
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      {getServiceScope(service).label}
                    </p>
                    <p className="mt-[4px] ui-font text-[15px] font-semibold text-slate-800">
                      {getServiceScope(service).value}
                    </p>
                  </div>
                </div>

                {service.includes_text && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Kas įskaičiuota
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.includes_text}
                    </p>
                  </div>
                )}

                {service.service_type === "cake" && service.ingredients && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Ingredientai
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.ingredients}
                    </p>
                  </div>
                )}

                {service.notes && (
                  <div className="mt-[14px] rounded-[18px] bg-slate-50 p-[12px]">
                    <p className="ui-font text-[12px] text-slate-500">
                      Pastabos
                    </p>
                    <p className="mt-[4px] ui-font text-[14px] leading-[22px] text-slate-700">
                      {service.notes}
                    </p>
                  </div>
                )}

                <div className="mt-[18px] flex flex-col gap-[10px] sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openEditModal(service)}
                    className="ui-font inline-flex h-[46px] flex-1 items-center justify-center rounded-[16px] bg-primary px-[16px] text-[14px] font-semibold text-white transition hover:bg-dark"
                  >
                    Valdyti paslaugą
                  </button>

                  <button
                    type="button"
                    onClick={() => openBlockModal(service)}
                    className="ui-font inline-flex h-[46px] flex-1 items-center justify-center rounded-[16px] border border-primary/25 bg-primary/10 px-[16px] text-[14px] font-semibold text-primary transition hover:bg-primary/15"
                  >
                    Blokuoti laiką
                  </button>

                  <button
                    type="button"
                    onClick={() => setServiceToDelete(service)}
                    disabled={deletingServiceId === service.id}
                    className="ui-font inline-flex h-[46px] flex-1 items-center justify-center rounded-[16px] border border-red-200 bg-red-50 px-[16px] text-[14px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingServiceId === service.id
                      ? "Trinama..."
                      : "Ištrinti"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ServiceBlockModal
        service={blockingService}
        form={blockForm}
        saving={savingBlock}
        error={blockError}
        onChange={updateBlockForm}
        onClose={closeBlockModal}
        onSubmit={handleCreateServiceBlock}
      />

      {editingProvider && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-[16px] py-[28px]">
          <section className="w-full max-w-[860px] rounded-[28px] bg-white p-[22px] shadow-xl">
            <div className="mb-[18px] flex items-start justify-between gap-[16px]">
              <div>
                <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
                  Paslaugų profilis
                </p>
                <h2 className="mt-[6px] ui-font text-[24px] font-semibold text-slate-900">
                  Kontaktinė informacija
                </h2>
              </div>

              <button
                type="button"
                onClick={closeProviderModal}
                className="ui-font flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] text-slate-600 transition hover:bg-slate-50"
                aria-label="Uždaryti"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="space-y-[14px]">
              <input
                type="text"
                value={providerForm.name}
                onChange={(e) => updateProviderForm("name", e.target.value)}
                placeholder="Paslaugų profilio pavadinimas"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />

              <textarea
                value={providerForm.description}
                onChange={(e) =>
                  updateProviderForm("description", e.target.value)
                }
                rows={3}
                placeholder="Trumpas profilio aprašymas"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />

              <div className="grid gap-[12px] md:grid-cols-2">
                <input
                  type="text"
                  value={providerForm.address}
                  onChange={(e) =>
                    updateProviderForm("address", e.target.value)
                  }
                  placeholder="Adresas"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                <input
                  type="text"
                  value={providerForm.city}
                  onChange={(e) => updateProviderForm("city", e.target.value)}
                  placeholder="Miestas"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-[12px] md:grid-cols-2">
                <input
                  type="email"
                  value={providerForm.email}
                  onChange={(e) => updateProviderForm("email", e.target.value)}
                  placeholder="El. paštas"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                <input
                  type="tel"
                  value={providerForm.phone}
                  onChange={(e) => updateProviderForm("phone", e.target.value)}
                  placeholder="Telefonas"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-[12px] md:grid-cols-2">
                <input
                  type="text"
                  value={providerForm.website}
                  onChange={(e) =>
                    updateProviderForm("website", e.target.value)
                  }
                  placeholder="Svetainė"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                <input
                  type="text"
                  value={providerForm.googleMapsUrl}
                  onChange={(e) =>
                    updateProviderForm("googleMapsUrl", e.target.value)
                  }
                  placeholder="Google Maps"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-[12px] md:grid-cols-3">
                <input
                  type="text"
                  value={providerForm.facebookUrl}
                  onChange={(e) =>
                    updateProviderForm("facebookUrl", e.target.value)
                  }
                  placeholder="Facebook"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                <input
                  type="text"
                  value={providerForm.instagramUrl}
                  onChange={(e) =>
                    updateProviderForm("instagramUrl", e.target.value)
                  }
                  placeholder="Instagram"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                <input
                  type="text"
                  value={providerForm.tiktokUrl}
                  onChange={(e) =>
                    updateProviderForm("tiktokUrl", e.target.value)
                  }
                  placeholder="TikTok"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-[10px] sm:flex-row">
                <button
                  type="submit"
                  disabled={savingProvider}
                  className="ui-font inline-flex h-[48px] flex-1 items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingProvider ? "Saugoma..." : "Išsaugoti profilį"}
                </button>

                <button
                  type="button"
                  onClick={closeProviderModal}
                  className="ui-font inline-flex h-[48px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[18px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Uždaryti
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingService && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-[16px] py-[28px]">
          <section className="w-full max-w-[920px] rounded-[28px] bg-white p-[22px] shadow-xl">
            <div className="mb-[18px] flex items-start justify-between gap-[16px]">
              <div>
                <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
                  Paslaugos valdymas
                </p>
                <h2 className="mt-[6px] ui-font text-[24px] font-semibold text-slate-900">
                  {editingService.name || "Paslauga"}
                </h2>
                <div className="mt-[10px] inline-flex flex-wrap items-center gap-[8px] rounded-[16px] bg-slate-50 px-[12px] py-[8px]">
                  <span className="ui-font text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    {getServiceScope(editingService).label}
                  </span>
                  <span className="ui-font text-[14px] font-semibold text-slate-900">
                    {getServiceScope(editingService).value}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="ui-font flex h-[40px] w-[40px] items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] text-slate-600 transition hover:bg-slate-50"
                aria-label="Uždaryti"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-[14px]">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => updateEditForm("name", e.target.value)}
                placeholder="Paslaugos pavadinimas"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />

              <div className="grid gap-[12px] md:grid-cols-2">
                <SelectControl
                  value={editForm.serviceType}
                  onChange={(nextValue) =>
                    updateEditForm("serviceType", nextValue)
                  }
                  options={SERVICE_TYPES}
                  buttonClassName="h-[48px]"
                />

                <SelectControl
                  value={editForm.unitsOfMeasure}
                  onChange={(nextValue) =>
                    updateEditForm("unitsOfMeasure", nextValue)
                  }
                  options={UNIT_OPTIONS}
                  buttonClassName="h-[48px]"
                />
              </div>

              <div className="grid gap-[12px] md:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.pricePerUnit}
                  onChange={(e) =>
                    updateEditForm("pricePerUnit", e.target.value)
                  }
                  placeholder="Kaina"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />

                {showsEditDurationField && (
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={editForm.durationMinutes}
                    onChange={(e) =>
                      updateEditForm("durationMinutes", e.target.value)
                    }
                    placeholder="Trukmė minutėmis"
                    className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                  />
                )}
              </div>

              <div className="grid gap-[12px] md:grid-cols-2">
                <label className="ui-font flex h-[48px] items-center gap-[10px] rounded-[16px] border border-slate-200 px-[14px] text-[14px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isListed}
                    onChange={(e) =>
                      updateEditForm("isListed", e.target.checked)
                    }
                    className="h-[16px] w-[16px]"
                  />
                  Rodoma klientams
                </label>

                <label className="ui-font flex h-[48px] items-center gap-[10px] rounded-[16px] border border-slate-200 px-[14px] text-[14px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isGlobal}
                    onChange={(e) =>
                      updateEditForm("isGlobal", e.target.checked)
                    }
                    className="h-[16px] w-[16px]"
                  />
                  Bendras katalogas
                </label>
              </div>

              <textarea
                value={editForm.shortDescription}
                onChange={(e) =>
                  updateEditForm("shortDescription", e.target.value)
                }
                rows={3}
                placeholder="Trumpas aprašymas"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />

              <textarea
                value={editForm.fullDescription}
                onChange={(e) =>
                  updateEditForm("fullDescription", e.target.value)
                }
                rows={4}
                placeholder="Pilnas aprašymas"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />

              <textarea
                value={editForm.includesText}
                onChange={(e) => updateEditForm("includesText", e.target.value)}
                rows={3}
                placeholder="Kas įskaičiuota"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />

              {editForm.serviceType === "cake" && (
                <textarea
                  value={editForm.ingredients}
                  onChange={(e) =>
                    updateEditForm("ingredients", e.target.value)
                  }
                  rows={3}
                  placeholder="Ingredientai"
                  className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
                />
              )}

              <textarea
                value={editForm.notes}
                onChange={(e) => updateEditForm("notes", e.target.value)}
                rows={3}
                placeholder="Pastabos"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />

              <div className="rounded-[18px] border border-slate-200 p-[14px]">
                <p className="ui-font text-[14px] font-semibold text-slate-800">
                  Nuotraukos
                </p>

                {editingService.images?.length > 0 && (
                  <div className="mt-[12px] grid gap-[10px] sm:grid-cols-2 md:grid-cols-3">
                    {editingService.images.map((image) => (
                      <div
                        key={image.id}
                        className="overflow-hidden rounded-[16px] border border-slate-200 bg-slate-50"
                      >
                        <ResponsiveImageFrame
                          src={image.imageUrl}
                          alt={image.alt_text || editForm.name}
                          ratio="16 / 10"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteServiceImage(image)}
                          className="ui-font h-[38px] w-full bg-white text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Ištrinti
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setEditPhotoFiles(Array.from(e.target.files || []))
                  }
                  className="ui-font mt-[12px] block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
                />

                {editPhotoPreviews.length > 0 && (
                  <div className="mt-[12px] grid gap-[10px] sm:grid-cols-2 md:grid-cols-3">
                    {editPhotoPreviews.map((item) => (
                      <div
                        key={item.url}
                        className="overflow-hidden rounded-[16px] border border-slate-200 bg-slate-50"
                      >
                        <ResponsiveImageFrame
                          src={item.url}
                          alt={item.name}
                          ratio="16 / 10"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-[10px] sm:flex-row">
                <button
                  type="submit"
                  disabled={savingService}
                  className="ui-font inline-flex h-[48px] flex-1 items-center justify-center rounded-[16px] bg-primary px-[18px] text-[14px] font-semibold text-white transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingService ? "Saugoma..." : "Išsaugoti pakeitimus"}
                </button>

                <button
                  type="button"
                  onClick={closeEditModal}
                  className="ui-font inline-flex h-[48px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[18px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Uždaryti
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <ConfirmModal
        open={Boolean(serviceToDelete)}
        title="Ištrinti paslaugą?"
        message={`Paslauga "${serviceToDelete?.name || ""}" bus pašalinta. Ar tikrai norite tęsti?`}
        confirmLabel="Taip, ištrinti"
        cancelLabel="Ne, palikti"
        loading={Boolean(deletingServiceId)}
        onCancel={() => setServiceToDelete(null)}
        onConfirm={handleDeleteService}
      />

      <ConfirmModal
        open={deleteProviderModalOpen}
        title="Ištrinti paslaugų profilį?"
        message="Bus pašalintas paslaugų profilis, visos jo paslaugos, nuotraukos ir užimti laikai. Susietos paslaugos taip pat bus pašalintos iš rezervacijų. Ar tikrai norite tęsti?"
        confirmLabel="Taip, ištrinti profilį"
        cancelLabel="Ne, palikti"
        loading={deletingProvider}
        onCancel={() => setDeleteProviderModalOpen(false)}
        onConfirm={handleDeleteProviderProfile}
      />
    </main>
  );
}
