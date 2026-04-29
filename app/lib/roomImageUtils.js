// lib/roomImageUtils.js
const BUCKET = "public-images";

function sortImages(images) {
  return [...(images || [])].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.position ?? 9999) - (b.position ?? 9999);
  });
}

function getPublicImageUrl(supabase, path) {
  if (!path) return null;

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return publicData?.publicUrl || null;
}

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
    .in("venue_id", venueIds)
    .is("room_id", null);

  const allImages = [...(roomImagesData || []), ...(venueImagesData || [])];

  return rooms.map((room) => {
    let imgs = allImages.filter((img) => img.room_id === room.id);

    if (imgs.length === 0) {
      imgs = allImages.filter(
        (img) => img.venue_id === room.venue_id && img.room_id == null
      );
    }

    let primaryImageUrl = null;

    if (imgs.length > 0) {
      primaryImageUrl = getPublicImageUrl(supabase, sortImages(imgs)[0]?.path);
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
  const { data: roomImages } = await supabase
    .from("images")
    .select("room_id, venue_id, path, is_primary, is_cover, position")
    .eq("room_id", roomId);

  let images = roomImages || [];

  if (images.length === 0 && venueId) {
    const { data: venueImages } = await supabase
      .from("images")
      .select("room_id, venue_id, path, is_primary, is_cover, position")
      .eq("venue_id", venueId)
      .is("room_id", null);

    images = venueImages || [];
  }

  if (images.length === 0) return [];

  return sortImages(images)
    .map((img) => getPublicImageUrl(supabase, img.path))
    .filter(Boolean);
}
