"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Loader from "@/app/components/Loader";
import ConfirmModal from "@/app/components/ConfirmModal";

const BUCKET = "public-images";

function sanitizeFileName(fileName) {
  return String(fileName || "photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");
}

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function getReadableError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.error_description) {
    return error.error_description;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackMessage;
  }
}

function createStepError(stepLabel, error) {
  const baseMessage = getReadableError(
    error,
    `${stepLabel}: ivyko nenumatyta klaida.`,
  );

  return new Error(`${stepLabel}: ${baseMessage}`);
}

export default function EditVenuePage() {
  const router = useRouter();
  const params = useParams();
  const venueId = params?.venueId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [coverFile, setCoverFile] = useState(null);

  const previewUrl = useMemo(() => {
    if (coverFile) {
      return URL.createObjectURL(coverFile);
    }
    return getPublicUrl(coverPath);
  }, [coverFile, coverPath]);

  useEffect(() => {
    return () => {
      if (coverFile && previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [coverFile, previewUrl]);

  useEffect(() => {
    let isMounted = true;

    async function loadVenue() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (!user) {
          router.replace("/prisijungti");
          return;
        }

        const { data: venue, error: venueError } = await supabase
          .from("venues")
          .select(
            "id, name, description, address, city, email, phone, website, facebook_url, google_maps_url",
          )
          .eq("id", venueId)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (venueError) throw venueError;
        if (!isMounted) return;

        if (!venue) {
          router.replace("/partner/venue");
          return;
        }

        const { data: coverImage } = await supabase
          .from("images")
          .select("id, path")
          .eq("venue_id", venue.id)
          .is("room_id", null)
          .eq("is_cover", true)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

        setName(venue.name || "");
        setDescription(venue.description || "");
        setAddress(venue.address || "");
        setCity(venue.city || "");
        setEmail(venue.email || "");
        setPhone(venue.phone || "");
        setWebsite(venue.website || "");
        setFacebookUrl(venue.facebook_url || "");
        setGoogleMapsUrl(venue.google_maps_url || "");
        setCoverPath(coverImage?.path || "");
      } catch (error) {
        console.error("load venue edit error:", error);
        if (isMounted) {
          setErrorMsg("Nepavyko uzkrauti erdves informacijos.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (venueId) {
      loadVenue();
    }

    return () => {
      isMounted = false;
    };
  }, [router, venueId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      const payload = {
        name: name.trim() || null,
        description: description.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        google_maps_url: googleMapsUrl.trim() || null,
      };

      const { error: updateError } = await supabase
        .from("venues")
        .update(payload)
        .eq("id", venueId)
        .eq("owner_id", user.id);

      if (updateError) throw updateError;

      if (coverFile) {
        const { data: existingCoverRows } = await supabase
          .from("images")
          .select("id, path")
          .eq("venue_id", venueId)
          .is("room_id", null)
          .eq("is_cover", true);

        const newCoverPath = `venues/${venueId}/cover/${Date.now()}-${sanitizeFileName(coverFile.name)}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(newCoverPath, coverFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const existingCover = existingCoverRows?.[0];

        if (existingCover) {
          const { error: imageUpdateError } = await supabase
            .from("images")
            .update({
              path: newCoverPath,
              alt_text: name.trim() || null,
              alt: name.trim() || null,
              is_primary: true,
              is_cover: true,
              position: 0,
            })
            .eq("id", existingCover.id);

          if (imageUpdateError) throw imageUpdateError;

          const oldPaths = existingCoverRows
            .map((item) => item.path)
            .filter((path) => path && path !== newCoverPath);

          if (oldPaths.length) {
            await supabase.storage.from(BUCKET).remove(oldPaths);
          }
        } else {
          const { error: imageInsertError } = await supabase
            .from("images")
            .insert({
              venue_id: venueId,
              room_id: null,
              path: newCoverPath,
              alt_text: name.trim() || null,
              alt: name.trim() || null,
              is_primary: true,
              is_cover: true,
              position: 0,
            });

          if (imageInsertError) throw imageInsertError;
        }

        setCoverPath(newCoverPath);
        setCoverFile(null);
      }

      setSuccessMsg("Erdves informacija issaugota.");
    } catch (error) {
      console.error("save venue error:", error);
      setErrorMsg("Nepavyko issaugoti erdves informacijos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteVenue() {
    setDeleting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/prisijungti");
        return;
      }

      const { data: ownedVenue, error: venueAccessError } = await supabase
        .from("venues")
        .select("id")
        .eq("id", venueId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (venueAccessError) {
        throw createStepError("Nepavyko patikrinti erdves teisiu", venueAccessError);
      }
      if (!ownedVenue) {
        router.replace("/partner/venue");
        return;
      }

      const { data: roomRows, error: roomsError } = await supabase
        .from("rooms")
        .select("id")
        .eq("venue_id", venueId);

      if (roomsError) {
        throw createStepError("Nepavyko gauti kambariu saraso", roomsError);
      }

      const roomIds = (roomRows || []).map((item) => item.id);

      let servicesQuery = supabase.from("services").select("id").eq("venue_id", venueId);

      if (roomIds.length) {
        servicesQuery = supabase
          .from("services")
          .select("id")
          .or(`venue_id.eq.${venueId},room_id.in.(${roomIds.join(",")})`);
      }

      const { data: serviceRows, error: servicesError } = await servicesQuery;

      if (servicesError) {
        throw createStepError("Nepavyko gauti susietu paslaugu", servicesError);
      }

      const serviceIds = Array.from(new Set((serviceRows || []).map((item) => item.id)));

      let bookingRows = [];

      if (roomIds.length) {
        const { data, error } = await supabase
          .from("bookings")
          .select("id")
          .in("room_id", roomIds);

        if (error) {
          throw createStepError("Nepavyko gauti rezervaciju", error);
        }
        bookingRows = data || [];
      }

      const bookingIds = bookingRows.map((item) => item.id);

      const { data: imageRows, error: imagesError } = await supabase
        .from("images")
        .select("id, path")
        .eq("venue_id", venueId);

      if (imagesError) {
        throw createStepError("Nepavyko gauti erdves nuotrauku", imagesError);
      }

      let serviceImageRows = [];

      if (serviceIds.length) {
        const { data, error } = await supabase
          .from("service_images")
          .select("id, path")
          .in("service_id", serviceIds);

        if (error) {
          throw createStepError("Nepavyko gauti paslaugu nuotrauku", error);
        }
        serviceImageRows = data || [];
      }

      if (bookingIds.length) {
        const { error } = await supabase
          .from("booking_approvals")
          .delete()
          .in("booking_id", bookingIds);

        if (error) {
          throw createStepError("Nepavyko istrinti rezervaciju tvirtinimu", error);
        }
      }

      const { error: venueApprovalsError } = await supabase
        .from("booking_approvals")
        .delete()
        .eq("venue_id", venueId);

      if (venueApprovalsError) {
        throw createStepError(
          "Nepavyko istrinti erdves tvirtinimu",
          venueApprovalsError,
        );
      }

      if (serviceIds.length) {
        const { error: serviceApprovalsError } = await supabase
          .from("booking_approvals")
          .delete()
          .in("service_id", serviceIds);

        if (serviceApprovalsError) {
          throw createStepError(
            "Nepavyko istrinti paslaugu tvirtinimu",
            serviceApprovalsError,
          );
        }

        const { error: bookingServicesByServiceError } = await supabase
          .from("booking_services")
          .delete()
          .in("service_id", serviceIds);

        if (bookingServicesByServiceError) {
          throw createStepError(
            "Nepavyko istrinti rezervaciju paslaugu rysiu",
            bookingServicesByServiceError,
          );
        }

        const { error: serviceImagesDeleteError } = await supabase
          .from("service_images")
          .delete()
          .in("service_id", serviceIds);

        if (serviceImagesDeleteError) {
          throw createStepError(
            "Nepavyko istrinti paslaugu nuotrauku irasu",
            serviceImagesDeleteError,
          );
        }
      }

      if (bookingIds.length) {
        const { error: bookingServicesByBookingError } = await supabase
          .from("booking_services")
          .delete()
          .in("booking_id", bookingIds);

        if (bookingServicesByBookingError) {
          throw createStepError(
            "Nepavyko istrinti rezervaciju papildomu paslaugu",
            bookingServicesByBookingError,
          );
        }
      }

      if (roomIds.length) {
        const { error: favoritesError } = await supabase
          .from("favorite_rooms")
          .delete()
          .in("room_id", roomIds);

        if (favoritesError) {
          throw createStepError("Nepavyko istrinti megstamu kambariu irasu", favoritesError);
        }

        const { error: categoriesError } = await supabase
          .from("room_categories")
          .delete()
          .in("room_id", roomIds);

        if (categoriesError) {
          throw createStepError("Nepavyko istrinti kambario kategoriju", categoriesError);
        }

        const { error: roomUnavailabilityError } = await supabase
          .from("room_unavailability")
          .delete()
          .in("room_id", roomIds);

        if (roomUnavailabilityError) {
          throw createStepError(
            "Nepavyko istrinti kambario nepasiekiamumo irasu",
            roomUnavailabilityError,
          );
        }

        const { error: availabilityError } = await supabase
          .from("availability")
          .delete()
          .in("room_id", roomIds);

        if (availabilityError) {
          throw createStepError("Nepavyko istrinti kambario darbo laiko", availabilityError);
        }
      }

      const { error: reviewsError } = await supabase
        .from("reviews")
        .delete()
        .eq("venue_id", venueId);

      if (reviewsError) {
        throw createStepError("Nepavyko istrinti atsiliepimu", reviewsError);
      }

      const { error: imagesDeleteError } = await supabase
        .from("images")
        .delete()
        .eq("venue_id", venueId);

      if (imagesDeleteError) {
        throw createStepError("Nepavyko istrinti erdves nuotrauku irasu", imagesDeleteError);
      }

      if (bookingIds.length) {
        const { error: bookingsDeleteError } = await supabase
          .from("bookings")
          .delete()
          .in("id", bookingIds);

        if (bookingsDeleteError) {
          throw createStepError("Nepavyko istrinti rezervaciju", bookingsDeleteError);
        }
      }

      if (serviceIds.length) {
        const { error: servicesDeleteError } = await supabase
          .from("services")
          .delete()
          .in("id", serviceIds);

        if (servicesDeleteError) {
          throw createStepError("Nepavyko istrinti paslaugu", servicesDeleteError);
        }
      }

      if (roomIds.length) {
        const { error: roomsDeleteError } = await supabase
          .from("rooms")
          .delete()
          .in("id", roomIds);

        if (roomsDeleteError) {
          throw createStepError("Nepavyko istrinti kambariu", roomsDeleteError);
        }
      }

      const { error: venueDeleteError } = await supabase
        .from("venues")
        .delete()
        .eq("id", venueId)
        .eq("owner_id", user.id);

      if (venueDeleteError) {
        throw createStepError("Nepavyko istrinti zaidimu erdves", venueDeleteError);
      }

      const storagePaths = [...(imageRows || []), ...serviceImageRows]
        .map((item) => item.path)
        .filter(Boolean);

      if (storagePaths.length) {
        await supabase.storage.from(BUCKET).remove(storagePaths);
      }

      router.replace("/partner");
    } catch (error) {
      console.error("delete venue error:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        statusCode: error?.statusCode,
        raw: error,
      });
      setErrorMsg(
        getReadableError(
          error,
          "Nepavyko istrinti zaidimu erdves. Gali buti, kad vis dar yra susietu rezervaciju arba truksta DB leidimu.",
        ),
      );
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="mx-auto max-w-[900px] px-[16px] py-[40px]">
      <div className="mb-[24px] flex flex-col gap-[12px] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-font text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
            Zaidimu erdves informacija
          </p>
          <h1 className="mt-[8px] ui-font text-[32px] font-semibold text-slate-900">
            Redaguoti erdve
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/partner/venue")}
          className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Grizti i valdyma
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

      <section className="rounded-[28px] bg-white p-[24px] shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-[16px]">
          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Pavadinimas
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Aprasymas
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="ui-font w-full rounded-[16px] border border-slate-200 px-[14px] py-[12px] text-[14px] outline-none focus:border-primary"
            />
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Adresas
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Miestas
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                El. pastas
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Telefonas
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-[12px] md:grid-cols-2">
            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Svetaine
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-[6px]">
              <label className="ui-font text-[13px] text-slate-600">
                Facebook
              </label>
              <input
                type="text"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-[6px]">
            <label className="ui-font text-[13px] text-slate-600">
              Google Maps nuoroda
            </label>
            <input
              type="text"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              className="ui-font h-[48px] w-full rounded-[16px] border border-slate-200 px-[14px] text-[14px] outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-[10px]">
            <label className="ui-font text-[13px] text-slate-600">
              Cover nuotrauka
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="ui-font block w-full text-[14px] text-slate-600 file:mr-[14px] file:rounded-full file:border-0 file:bg-primary file:px-[16px] file:py-[10px] file:text-[14px] file:font-semibold file:text-white"
            />

            {previewUrl ? (
              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                <Image
                  src={previewUrl}
                  alt={name || "Venue cover"}
                  width={1200}
                  height={720}
                  unoptimized
                  className="h-[240px] w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-[18px] bg-slate-50 p-[14px]">
            <p className="ui-font text-[13px] leading-[21px] text-slate-600">
              Instagram ir TikTok lauku dar nera duomenu bazeje, todel siuo metu
              redagavime saugomi tik esami kontaktiniai laukai.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || deleting}
            className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-primary px-[18px] text-[15px] font-semibold text-white shadow-md transition hover:bg-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? "Saugoma..." : "Issaugoti pakeitimus"}
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            disabled={submitting || deleting}
            className="ui-font inline-flex h-[50px] w-full items-center justify-center rounded-[18px] border border-red-200 bg-red-50 px-[18px] text-[15px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Trinama..." : "Istrinti zaidimu erdve"}
          </button>
        </form>
      </section>

      <ConfirmModal
        open={deleteModalOpen}
        title="Istrinti zaidimu erdve?"
        message="Bus istrinti visi susieti kambariai, ju nuotraukos, paslaugos ir kita su sia erdve susijusi informacija. Ar tikrai norite testi?"
        confirmLabel="Taip, istrinti"
        cancelLabel="Ne, palikti"
        loading={deleting}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteVenue}
      />
    </main>
  );
}
