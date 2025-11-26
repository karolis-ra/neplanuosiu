// lib/roomImageUtils.js
const BUCKET = "public-images";

export async function buildRoomsWithImages({ supabase, rooms }) {
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);
  const venueIds = Array.from(
    new Set(rooms.map((r) => r.venue_id).filter(Boolean))
  );

  const { data: venuesData } = await supabase
    .from("venues")
    .select("id, address, city")
    .in("id", venueIds);

  const venueMap =
    venuesData?.reduce((acc, v) => {
      acc[v.id] = v;
      return acc;
    }, {}) || {};

  const { data: roomImagesData } = await supabase
    .from("images")
    .select("room_id, venue_id, path, is_primary, is_cover, position")
    .in("room_id", roomIds);

  const { data: venueImagesData } = await supabase
    .from("images")
    .select("room_id, venue_id, path, is_primary, is_cover, position")
    .in("venue_id", venueIds);

  const allImages = [...(roomImagesData || []), ...(venueImagesData || [])];

  return rooms.map((room) => {
    let imgs = allImages.filter((img) => img.room_id === room.id);

    if (imgs.length === 0) {
      imgs = allImages.filter((img) => img.venue_id === room.venue_id);
    }

    let primaryImageUrl = null;

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

        primaryImageUrl = publicData?.publicUrl || null;
      }
    }

    const venue = venueMap[room.venue_id] || {};

    return {
      ...room,
      primaryImageUrl,
      venue_address: venue.address || "",
      venue_city: venue.city || "",
    };
  });
}

export async function getRoomGalleryImages({ supabase, roomId, venueId }) {
  const { data: images } = await supabase
    .from("images")
    .select("room_id, venue_id, path, is_primary, is_cover, position")
    .or(`room_id.eq.${roomId},venue_id.eq.${venueId}`);

  if (!images || images.length === 0) return [];

  const sorted = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.position ?? 9999) - (b.position ?? 9999);
  });

  return sorted
    .map((img) => {
      if (!img.path) return null;
      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(img.path);
      return publicData?.publicUrl || null;
    })
    .filter(Boolean);
}
