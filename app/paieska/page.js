// app/paieska/page.js
import { supabase } from "../lib/supabaseClient";
import { buildRoomsWithImages } from "../lib/roomImageUtils";
import SearchFilters from "../components/SearchFilters";
import SearchRoomsGrid from "../components/SearchRoomsGrid";
import SearchMapSection from "../components/SearchMapSection";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams: searchParamsPromise,
}) {
  const searchParams = await searchParamsPromise;

  const miestas = searchParams?.miestas || "";
  const data = searchParams?.data || "";
  const laikas = searchParams?.laikas || "";
  const zmones = searchParams?.zmones ? Number(searchParams.zmones) : null;

  let rooms = [];
  let error = null;

  const { data: roomsData, error: roomsError } = await supabase
    .from("rooms")
    .select(
      `
      id,
      venue_id,
      name,
      description,
      price,
      capacity,
      city,
      is_listed,
      venues (
        id,
        name,
        latitude,
        longitude
      )
    `,
    )
    .eq("is_listed", true)
    .order("price", { ascending: true });

  if (roomsError) {
    error = roomsError;
  } else {
    rooms = roomsData || [];

    if (miestas) {
      rooms = rooms.filter((room) => room.city === miestas);
    }

    if (zmones) {
      rooms = rooms.filter((room) => !room.capacity || room.capacity >= zmones);
    }
  }

  let roomsWithImages = rooms;
  if (!error && rooms.length > 0) {
    roomsWithImages = await buildRoomsWithImages({ supabase, rooms });
  }

  roomsWithImages = roomsWithImages.map((room) => ({
    ...room,
    venue_name: room.venues?.name || "",
    venue_address: room.venues?.address || "",
    venue_city: room.venues?.city || room.city || "",
  }));

  const venueMap = new Map();

  for (const room of roomsWithImages) {
    const venue = room.venues;
    if (!venue || venue.latitude == null || venue.longitude == null) continue;

    if (!venueMap.has(venue.id)) {
      venueMap.set(venue.id, {
        id: venue.id,
        venueName: venue.name,
        city: room.city,
        latitude: venue.latitude,
        longitude: venue.longitude,
        rooms: [],
      });
    }

    venueMap.get(venue.id).rooms.push({
      id: room.id,
      name: room.name,
      price: room.price,
      imageUrl: room.primaryImageUrl || room.imageUrl || null,
    });
  }

  const mapVenues = Array.from(venueMap.values());

  return (
    <div className="mx-auto mt-6 max-w-6xl px-4 pb-10">
      <SearchFilters
        initialCity={miestas}
        initialDate={data}
        initialTime={laikas}
        initialPeople={searchParams?.zmones || ""}
      />

      <SearchMapSection rooms={mapVenues} selectedCity={miestas} />

      <div className="mt-4 flex items-center justify-between">
        <h1 className="heading text-xl font-bold text-dark">
          Rasti žaidimų kambariai
        </h1>
        <p className="ui-font text-sm text-slate-600">
          {roomsWithImages.length} kambarių rasta
        </p>
      </div>

      {error && (
        <div className="ui-font mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          Klaida gaunant kambarius: {error.message}
        </div>
      )}

      <SearchRoomsGrid rooms={roomsWithImages} hasError={Boolean(error)} />
    </div>
  );
}
