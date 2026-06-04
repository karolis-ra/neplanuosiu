import Link from "next/link";
import { notFound } from "next/navigation";
import ProviderProfileClient from "../../components/ProviderProfileClient";
import { supabase } from "../../lib/supabaseClient";
import { buildRoomsWithImages } from "../../lib/roomImageUtils";
import { mapServiceImagesWithUrls } from "../../lib/serviceImageUtils";

export const dynamic = "force-dynamic";

function sortServiceImages(images) {
  return [...(images || [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.position ?? 9999) - (b.position ?? 9999);
  });
}

function cleanMissingText(value) {
  const text = String(value || "").trim();
  if (!text || text.toLowerCase() === "nenurodyta") return null;
  return text;
}

function cleanProfileRecord(record) {
  if (!record) return null;

  return {
    ...record,
    name: cleanMissingText(record.name) || record.name,
    description: cleanMissingText(record.description),
    address: cleanMissingText(record.address),
    city: cleanMissingText(record.city),
    phone: cleanMissingText(record.phone),
    website: cleanMissingText(record.website),
  };
}

async function loadProviderProfile(id) {
  const [{ data: venueById }, { data: providerById }] = await Promise.all([
    supabase
      .from("venues")
      .select(
        "id, owner_id, name, description, address, city, phone, email, website, is_published",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("service_providers")
      .select(
        "id, owner_id, name, description, address, city, phone, email, website, is_published",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  let venue = venueById || null;
  let provider = providerById || null;

  if (venue?.owner_id && !provider) {
    const { data } = await supabase
      .from("service_providers")
      .select(
        "id, owner_id, name, description, address, city, phone, email, website, is_published",
      )
      .eq("owner_id", venue.owner_id)
      .maybeSingle();

    provider = data || null;
  }

  if (provider?.owner_id && !venue) {
    const { data } = await supabase
      .from("venues")
      .select(
        "id, owner_id, name, description, address, city, phone, email, website, is_published",
      )
      .eq("owner_id", provider.owner_id)
      .maybeSingle();

    venue = data || null;
  }

  if (!venue && !provider) return null;

  let rooms = [];
  if (venue?.id) {
    const { data: roomRows } = await supabase
      .from("rooms")
      .select(
        "id, venue_id, name, description, price, capacity, city, is_listed",
      )
      .eq("venue_id", venue.id)
      .eq("is_listed", true)
      .order("price", { ascending: true });

    rooms = await buildRoomsWithImages({
      supabase,
      rooms: roomRows || [],
    });
  }

  const serviceFilters = [];
  if (provider?.id) serviceFilters.push(`provider_id.eq.${provider.id}`);
  if (venue?.id) serviceFilters.push(`venue_id.eq.${venue.id}`);

  let services = [];
  if (serviceFilters.length) {
    const { data: serviceRows } = await supabase
      .from("services")
      .select(
        `
        id,
        provider_id,
        venue_id,
        room_id,
        name,
        description,
        short_description,
        full_description,
        ingredients,
        includes_text,
        notes,
        service_type,
        price_per_unit,
        units_of_measure,
        duration_minutes,
        is_global,
        is_listed,
        sort_order
      `,
      )
      .eq("is_listed", true)
      .or(serviceFilters.join(","))
      .order("sort_order", { ascending: true })
      .order("price_per_unit", { ascending: true });

    const serviceIds = (serviceRows || []).map((service) => service.id);
    let imagesByServiceId = new Map();

    if (serviceIds.length) {
      const { data: imageRows } = await supabase
        .from("service_images")
        .select("id, service_id, path, alt_text, is_primary, position")
        .in("service_id", serviceIds)
        .order("position", { ascending: true });

      const mappedImages = mapServiceImagesWithUrls({
        supabase,
        images: imageRows || [],
      });

      imagesByServiceId = mappedImages.reduce((acc, image) => {
        if (!acc.has(image.service_id)) acc.set(image.service_id, []);
        acc.get(image.service_id).push(image);
        return acc;
      }, new Map());
    }

    services = (serviceRows || []).map((service) => {
      const images = sortServiceImages(imagesByServiceId.get(service.id) || [])
        .map((image) => ({
          url: image.imageUrl,
          alt: image.alt_text || service.name,
          is_primary: image.is_primary,
          position: image.position,
        }))
        .filter((image) => image.url);
      const primaryImage = images[0] || null;

      return {
        ...service,
        provider_name: provider?.name || venue?.name || "Partneris",
        image_url: primaryImage?.url || null,
        image_alt: primaryImage?.alt || service.name,
        images,
      };
    });
  }

  return {
    venue: cleanProfileRecord(venue),
    provider: cleanProfileRecord(provider),
    rooms: rooms.map((room) => ({
      ...room,
      description: cleanMissingText(room.description),
      city: cleanMissingText(room.city),
    })),
    services: services.map((service) => ({
      ...service,
      description: cleanMissingText(service.description),
      short_description: cleanMissingText(service.short_description),
      full_description: cleanMissingText(service.full_description),
      ingredients: cleanMissingText(service.ingredients),
      includes_text: cleanMissingText(service.includes_text),
      notes: cleanMissingText(service.notes),
      provider_name: cleanMissingText(service.provider_name) || "Partneris",
    })),
  };
}

export default async function ProviderPage({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  const profile = id ? await loadProviderProfile(id) : null;

  if (!profile) notFound();

  const hasPublicContent = profile.rooms.length || profile.services.length;

  if (!hasPublicContent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="heading text-2xl font-bold text-slate-950">
            Partnerio informacija ruošiama
          </h1>
          <p className="ui-font mt-2 text-sm text-slate-600">
            Šis partneris dar nepaskelbė kambarių ar paslaugų.
          </p>
          <Link
            href="/paieska"
            className="ui-font mt-5 inline-flex h-11 items-center justify-center rounded-[15px] bg-primary px-5 text-sm font-bold text-white"
          >
            Grįžti į paiešką
          </Link>
        </div>
      </div>
    );
  }

  return <ProviderProfileClient {...profile} />;
}
