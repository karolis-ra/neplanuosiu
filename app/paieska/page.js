// app/paieska/page.js
import { supabase } from "../lib/supabaseClient";
import { buildRoomsWithImages } from "../lib/roomImageUtils";
import SearchFilters from "../components/SearchFilters";
import RoomCard from "../components/RoomCard";
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
        latitude,
        longitude
      )
    `
    )
    .eq("is_listed", true)
    .order("price", { ascending: true });

  if (roomsError) {
    error = roomsError;
  } else {
    rooms = roomsData || [];

    if (miestas) {
      rooms = rooms.filter((r) => r.city === miestas);
    }

    if (zmones) {
      rooms = rooms.filter((r) => !r.capacity || r.capacity >= zmones);
    }
  }

  let roomsWithImages = rooms;

  if (!error && rooms.length > 0) {
    roomsWithImages = await buildRoomsWithImages({ supabase, rooms });
  }

  const mapRooms = roomsWithImages.map((room) => ({
    id: room.id,
    name: room.name,
    city: room.city,
    price: room.price,
    latitude: room.venues?.latitude ?? null,
    longitude: room.venues?.longitude ?? null,
    imageUrl: room.primaryImageUrl || room.imageUrl || null, // priklausomai kaip pavadinta
  }));

  return (
    <div className="mx-auto mt-6 max-w-6xl px-4 pb-10">
      <SearchFilters
        initialCity={miestas}
        initialDate={data}
        initialTime={laikas}
        initialPeople={searchParams?.zmones || ""}
      />

      <SearchMapSection rooms={mapRooms} selectedCity={miestas} />

      <div className="mt-4 flex items-center justify-between">
        <h1 className="heading text-xl font-bold text-dark">
          Rasti žaidimų kambariai
        </h1>
        <p className="ui-font text-sm text-slate-600">
          {roomsWithImages.length} kambarių rasta
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ui-font">
          Klaida gaunant kambarius: {error.message}
        </div>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roomsWithImages.length === 0 && !error && (
          <div className="ui-font md:col-span-2 lg:col-span-3 rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
            Neradome kambarių pagal pasirinktus kriterijus.
          </div>
        )}

        {roomsWithImages.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </section>
    </div>
  );
}
