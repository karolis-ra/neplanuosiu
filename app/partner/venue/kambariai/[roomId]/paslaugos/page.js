"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import { mapServiceImagesWithUrls } from "../../../../../lib/serviceImageUtils";
import Loader from "../../../../../components/Loader";
import ConfirmModal from "../../../../../components/ConfirmModal";
import ResponsiveImageFrame from "../../../../../components/ResponsiveImageFrame";

const BUCKET = "public-images";

const SERVICE_TYPES = [
  { value: "decorations", label: "Dekoracijos" },
  { value: "animator", label: "Animatorius" },
  { value: "cake", label: "Tortas" },
];

const SERVICE_TYPES_WITH_DURATION = ["animator"];

const UNIT_OPTIONS = [
  { value: "unit", label: "vnt." },
  { value: "hour", label: "val." },
  { value: "booking", label: "uz rezervacija" },
  { value: "child", label: "vaikui" },
  { value: "adult", label: "suaugusiam" },
];

const EMPTY_FORM = {
  id: "",
  name: "",
  serviceType: "decorations",
  pricePerUnit: "",
  unitsOfMeasure: "unit",
  durationMinutes: "",
  shortDescription: "",
  fullDescription: "",
  includesText: "",
  ingredients: "",
  notes: "",
};

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

export default function RoomServicesManagePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deletingServiceId, setDeletingServiceId] = useState("");

  const [room, setRoom] = useState(null);
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [serviceToDelete, setServiceToDelete] = useState(null);

  const showsDurationField = SERVICE_TYPES_WITH_DURATION.includes(
    form.serviceType,
  );

  const photoPreviews = useMemo(
    () =>
      photoFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photoFiles],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [photoPreviews]);

  const loadData = useCallback(async (userId) => {
    const { data: roomRow, error: roomError } = await supabase
      .from("rooms")
      .select("id, name, venue_id")
      .eq("id", roomId)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!roomRow) {
      router.replace("/partner/venue");
      return;
    }

    const { data: venueRow, error: venueError } = await supabase
      .from("venues")
      .select("id, owner_id")
      .eq("id", roomRow.venue_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (venueError) throw venueError;
    if (!venueRow) {
      router.replace("/partner/venue");
      return;
    }

    const { data: providerRow, error: providerError } = await supabase
      .from("service_providers")
      .select("id, name")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (providerError) throw providerError;

    const { data: serviceRows, error: servicesError } = await supabase
      .from("services")
      .select(
        "id, name, service_type, price_per_unit, units_of_measure, duration_minutes, short_description, full_description, includes_text, ingredients, notes",
      )
      .eq("room_id", roomId)
      .order("service_type", { ascending: true })
      .order("created_at", { ascending: true });

    if (servicesError) throw servicesError;

    const serviceIds = (serviceRows || []).map((service) => service.id);
    let imagesByServiceId = new Map();

    if (serviceIds.length) {
      const { data: serviceImagesRows, error: serviceImagesError } =
        await supabase
          .from("service_images")
          .select("id, service_id, path, alt_text, is_primary, position")
          .in("service_id", serviceIds)
          .order("position", { ascending: true });

      if (serviceImagesError) throw serviceImagesError;

      const mappedImages = mapServiceImagesWithUrls({
        supabase,
        images: serviceImagesRows || [],
      });

      imagesByServiceId = mappedImages.reduce((acc, image) => {
        if (!acc.has(image.service_id)) {
          acc.set(image.service_id, []);
        }
        acc.get(image.service_id).push(image);
        return acc;
      }, new Map());
    }

    setRoom(roomRow);
    setProvider(providerRow || null);
    setServices(
      (serviceRows || []).map((service) => ({
        ...service,
        images: imagesByServiceId.get(service.id) || [],
      })),
    );
  }, [roomId, router]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/prisijungti");
          return;
        }

        await loadData(user.id);
      } catch (error) {
        console.error("load room services error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko uzkrauti kambario paslaugu.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (roomId) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [loadData, roomId, router]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "serviceType" && !SERVICE_TYPES_WITH_DURATION.includes(value)
        ? { durationMinutes: "" }
        : {}),
    }));
  }

  function startEdit(service) {
    setForm({
      id: service.id,
      name: service.name || "",
      serviceType: service.service_type || "decorations",
      pricePerUnit: String(service.price_per_unit ?? ""),
      unitsOfMeasure: service.units_of_measure || "unit",
      durationMinutes: service.duration_minutes == null ? "" : String(service.duration_minutes),
      shortDescription: service.short_description || "",
      fullDescription: service.full_description || "",
      includesText: service.includes_text || "",
      ingredients: service.ingredients || "",
      notes: service.notes || "",
    });
    setPhotoFiles([]);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setPhotoFiles([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const serviceId = form.id || crypto.randomUUID();
    const uploadedPaths = [];
    const isNewService = !form.id;

    try {
      if (!provider?.id || !room?.venue_id) {
        throw new Error("missing_provider");
      }

      const existingImageCount =
        services.find((service) => service.id === form.id)?.images?.length || 0;

      const payload = {
        provider_id: provider.id,
        venue_id: room.venue_id,
        room_id: room.id,
        name: form.name.trim() || null,
        description: form.fullDescription.trim() || form.shortDescription.trim() || null,
        short_description: form.shortDescription.trim() || null,
        full_description: form.fullDescription.trim() || null,
        includes_text: form.includesText.trim() || null,
        ingredients:
          form.serviceType === "cake" ? form.ingredients.trim() || null : null,
        notes: form.notes.trim() || null,
        service_type: form.serviceType,
        price_per_unit:
          form.pricePerUnit === "" ? null : Number(form.pricePerUnit),
        units_of_measure: form.unitsOfMeasure,
        duration_minutes: showsDurationField
          ? form.durationMinutes === ""
            ? null
            : Number(form.durationMinutes)
          : null,
        is_global: false,
        is_listed: true,
      };

      if (form.id) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", form.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert({ ...payload, id: serviceId });
        if (error) throw error;
      }

      for (let index = 0; index < photoFiles.length; index += 1) {
        const file = photoFiles[index];
        const path = `services/${provider.id}/${serviceId}/${Date.now()}-${index}-${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedPaths.push(path);
      }

      if (uploadedPaths.length) {
        const imageRows = uploadedPaths.map((path, index) => ({
          service_id: serviceId,
          path,
          alt_text: form.name.trim() || null,
          is_primary: existingImageCount === 0 && index === 0,
          position: existingImageCount + index,
        }));

        const { error: serviceImagesError } = await supabase
          .from("service_images")
          .insert(imageRows);

        if (serviceImagesError) throw serviceImagesError;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await loadData(user.id);
      resetForm();
      setSuccessMsg("Kambario paslaugos issaugotos.");
    } catch (error) {
      console.error("save room service error:", error);
      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
        await supabase
          .from("service_images")
          .delete()
          .in("path", uploadedPaths);
      }
      if (isNewService) {
        await supabase.from("services").delete().eq("id", serviceId);
      }
      setErrorMsg(
        provider?.id
          ? "Nepavyko issaugoti kambario paslaugos."
          : "Norint kurti kambario paslaugas, pirma reikia susikurti paslaugu teikejo profili.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!serviceToDelete) {
      return;
    }

    try {
      setDeletingServiceId(serviceToDelete.id);
      setErrorMsg("");
      setSuccessMsg("");

      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceToDelete.id);

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await loadData(user.id);
      setServiceToDelete(null);
      setSuccessMsg("Paslauga istrinta.");
    } catch (error) {
      console.error("delete room service error:", error);
      setErrorMsg("Nepavyko istrinti paslaugos.");
    } finally {
      setDeletingServiceId("");
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[1100px] px-[16px] py-[40px]">
      <div className="mb-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Kambario paslaugos
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            {room?.name || "Kambarys"}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/partner/venue/kambariai/${roomId}`)}
          className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Grizti i kambario valdyma
        </button>
      </div>

      {errorMsg && (
        <div className="mb-[16px] rounded-[16px] bg-red-50 px-[14px] py-[10px]">
          <p className="ui-font text-[14px] text-red-600">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-[16px] rounded-[16px] bg-emerald-50 px-[14px] py-[10px]">
          <p className="ui-font text-[14px] text-emerald-700">{successMsg}</p>
        </div>
      )}

      {!provider && (
        <div className="mb-[20px] rounded-[20px] border border-amber-200 bg-amber-50 px-[16px] py-[14px]">
          <p className="ui-font text-[14px] leading-[22px] text-amber-800">
            Kambario paslaugoms reikia paslaugu teikejo profilio, nes pagal
            dabartine duomenu baze kiekviena paslauga priklauso provideriui.
          </p>
          <button
            type="button"
            onClick={() => router.push("/partner/onboarding/paslaugos")}
            className="ui-font mt-[12px] inline-flex h-[42px] items-center justify-center rounded-[14px] bg-primary px-[16px] text-[14px] font-semibold text-white"
          >
            Sukurti paslaugu profili
          </button>
        </div>
      )}

      <div className="grid gap-[20px] lg:grid-cols-[1.05fr,0.95fr]">
        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <h2 className="ui-font text-[22px] font-semibold text-slate-900">
            Esamos paslaugos
          </h2>

          {services.length === 0 ? (
            <p className="ui-font mt-[14px] text-[14px] text-slate-500">
              Siam kambariui paslaugu dar nera.
            </p>
          ) : (
            <div className="mt-[16px] space-y-[12px]">
              {services.map((service) => (
                <article
                  key={service.id}
                  className="rounded-[20px] border border-slate-200 p-[16px]"
                >
                  {service.images?.length > 0 && (
                    <div className="mb-[12px] flex gap-[8px] overflow-x-auto">
                      {service.images.slice(0, 4).map((image) => (
                        <div
                          key={image.id}
                          className="h-[72px] w-[96px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100"
                        >
                          <ResponsiveImageFrame
                            src={image.imageUrl}
                            alt={image.alt_text || service.name || "Paslauga"}
                            ratio="4 / 3"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-[12px]">
                    <div>
                      <h3 className="ui-font text-[18px] font-semibold text-slate-900">
                        {service.name}
                      </h3>
                      <p className="ui-font mt-[4px] text-[13px] text-slate-500">
                        {
                          SERVICE_TYPES.find(
                            (item) => item.value === service.service_type,
                          )?.label
                        }{" "}
                        • {formatPrice(service.price_per_unit)} /{" "}
                        {
                          UNIT_OPTIONS.find(
                            (item) => item.value === service.units_of_measure,
                          )?.label
                        }
                      </p>
                    </div>

                    <div className="flex gap-[8px]">
                      <button
                        type="button"
                        onClick={() => startEdit(service)}
                        className="ui-font text-[13px] font-semibold text-primary"
                      >
                        Redaguoti
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceToDelete(service)}
                        className="ui-font text-[13px] font-semibold text-red-600"
                      >
                        Istrinti
                      </button>
                    </div>
                  </div>

                  {service.short_description && (
                    <p className="ui-font mt-[10px] text-[14px] leading-[22px] text-slate-600">
                      {service.short_description}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
          <div className="flex items-center justify-between gap-[12px]">
            <h2 className="ui-font text-[22px] font-semibold text-slate-900">
              {form.id ? "Redaguoti paslauga" : "Prideti paslauga"}
            </h2>
            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="ui-font text-[13px] font-semibold text-slate-500"
              >
                Nauja forma
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-[16px] space-y-[16px]">
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Paslaugos pavadinimas"
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
            />

            <div className="grid gap-[12px] md:grid-cols-2">
              <select
                value={form.serviceType}
                onChange={(e) => updateForm("serviceType", e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              >
                {SERVICE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={form.unitsOfMeasure}
                onChange={(e) => updateForm("unitsOfMeasure", e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 bg-white px-[14px] text-[14px] outline-none focus:border-primary"
              >
                {UNIT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-[12px] md:grid-cols-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerUnit}
                onChange={(e) => updateForm("pricePerUnit", e.target.value)}
                placeholder="Kaina"
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />

              {showsDurationField && (
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    updateForm("durationMinutes", e.target.value)
                  }
                  placeholder="Trukme minutemis"
                  className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
                />
              )}
            </div>

            <textarea
              value={form.shortDescription}
              onChange={(e) => updateForm("shortDescription", e.target.value)}
              rows={3}
              placeholder="Trumpas aprasymas"
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
            />

            <textarea
              value={form.fullDescription}
              onChange={(e) => updateForm("fullDescription", e.target.value)}
              rows={4}
              placeholder="Pilnas aprasymas"
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
            />

            <textarea
              value={form.includesText}
              onChange={(e) => updateForm("includesText", e.target.value)}
              rows={3}
              placeholder="Kas iskaiciuota"
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
            />

            {form.serviceType === "cake" && (
              <textarea
                value={form.ingredients}
                onChange={(e) => updateForm("ingredients", e.target.value)}
                rows={3}
                placeholder="Ingredientai"
                className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
              />
            )}

            <textarea
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              rows={3}
              placeholder="Pastabos"
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
            />

            <div className="space-y-[10px] rounded-[18px] border border-slate-200 p-[14px]">
              <div>
                <p className="ui-font text-[14px] font-semibold text-slate-800">
                  Nuotraukos
                </p>
                {form.id &&
                  services.find((service) => service.id === form.id)?.images
                    ?.length > 0 && (
                    <p className="ui-font mt-[4px] text-[12px] text-slate-500">
                      Naujos nuotraukos bus pridėtos prie esamų.
                    </p>
                  )}
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setPhotoFiles(Array.from(e.target.files || []))
                }
                className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
              />

              {photoPreviews.length > 0 && (
                <div className="grid gap-[10px] sm:grid-cols-2">
                  {photoPreviews.map((item) => (
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

            <button
              type="submit"
              disabled={saving || !provider}
              className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saugoma..." : form.id ? "Issaugoti paslauga" : "Prideti paslauga"}
            </button>
          </form>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(serviceToDelete)}
        title="Istrinti paslauga?"
        message={`Paslauga "${serviceToDelete?.name || ""}" bus istrinta is sio kambario. Ar tikrai norite testi?`}
        confirmLabel="Taip, istrinti"
        cancelLabel="Ne, palikti"
        loading={Boolean(deletingServiceId)}
        onCancel={() => setServiceToDelete(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
