// app/paieska/page.js
import { supabase } from "../lib/supabaseClient";
import SearchFilters from "../components/SearchFilters";
import RoomCard from "../components/RoomCard";

export const dynamic = "force-dynamic";

const BUCKET = "public-images";

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

  // 1) kambariai
  const { data: roomsData, error: roomsError } = await supabase
    .from("rooms")
    .select("id, venue_id, name, description, price, capacity, city, is_listed")
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
    const roomIds = rooms.map((r) => r.id);
    const venueIds = Array.from(
      new Set(rooms.map((r) => r.venue_id).filter(Boolean))
    );

    // 2) venue duomenys (adresui)
    const { data: venuesData } = await supabase
      .from("venues")
      .select("id, address, city")
      .in("id", venueIds);

    const venueMap =
      venuesData?.reduce((acc, v) => {
        acc[v.id] = v;
        return acc;
      }, {}) || {};

    // 3) images (room + venue)
    const { data: roomImagesData } = await supabase
      .from("images")
      .select("room_id, venue_id, path, is_primary, is_cover, position")
      .in("room_id", roomIds);

    const { data: venueImagesData } = await supabase
      .from("images")
      .select("room_id, venue_id, path, is_primary, is_cover, position")
      .in("venue_id", venueIds);

    const allImages = [...(roomImagesData || []), ...(venueImagesData || [])];

    roomsWithImages = rooms.map((room) => {
      // pirmiausia – room nuotraukos
      let imgs = allImages.filter((img) => img.room_id === room.id);

      // jei nėra room – imame venue nuotraukas
      if (imgs.length === 0) {
        imgs = allImages.filter((img) => img.venue_id === room.venue_id);
      }

      let primaryUrl = null;

      if (imgs.length > 0) {
        const sorted = [...imgs].sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          if (a.is_cover && !b.is_cover) return -1;
          if (!a.is_cover && b.is_cover) return 1;
          return (a.position ?? 9999) - (b.position ?? 9999);
        });

        const chosen = sorted[0];

        if (chosen?.path) {
          const { data: publicData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(chosen.path);
          primaryUrl = publicData?.publicUrl || null;
        }
      }

      const venue = venueMap[room.venue_id] || {};

      return {
        ...room,
        primaryImageUrl: primaryUrl,
        venue_address: venue.address || "",
        venue_city: venue.city || "",
      };
    });
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl px-4 pb-10">
      {/* Filtrų juosta */}
      <SearchFilters
        initialCity={miestas}
        initialDate={data}
        initialTime={laikas}
        initialPeople={searchParams?.zmones || ""}
      />

      {/* Headeris */}
      <div className="mt-4 flex items-center justify-between">
        <h1 className="heading text-xl font-bold text-dark">
          Rasti žaidimų kambariai
        </h1>
        <p className="ui-font text-sm text-slate-600">
          {roomsWithImages.length} kambarių rasta
        </p>
      </div>

      {/* Klaida */}
      {error && (
        <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ui-font">
          Klaida gaunant kambarius: {error.message}
        </div>
      )}

      {/* Kortelės */}
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
