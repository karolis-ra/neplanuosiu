"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getRoomGalleryImages } from "../../lib/roomImageUtils";
import RoomGallery from "@/app/components/room/RoomGallery";
import RoomInfo from "@/app/components/room/RoomInfo";
import BookingDateTimePicker from "../../components/BookingDateTimePicker";
import VenueMap from "@/app/components/VenueMap";

async function fetchRoomData(roomId) {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, venue_id, name, description, price, capacity, duration_minutes, buffer_minutes, min_age, max_age, city, extra_hour_price",
    )
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    throw new Error(roomError?.message || "Kambarys nerastas");
  }

  const { data: venue } = await supabase
    .from("venues")
    .select(
      "id, name, address, city, phone, email, website, google_maps_url, latitude, longitude",
    )
    .eq("id", room.venue_id)
    .single();

  const imageUrls = await getRoomGalleryImages({
    supabase,
    roomId: room.id,
    venueId: room.venue_id,
  });

  const { data: availability } = await supabase
    .from("availability")
    .select("weekday, start_time, end_time")
    .eq("room_id", room.id)
    .order("weekday", { ascending: true });

  return {
    room,
    venue,
    imageUrls,
    availability: availability || [],
  };
}

export default function RoomBookingPage() {
  const params = useParams();
  const roomId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [venue, setVenue] = useState(null);
  const [images, setImages] = useState([]);
  const [availability, setAvailability] = useState([]);

  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchRoomData(roomId);
        setRoom(data.room);
        setVenue(data.venue);
        setImages(data.imageUrls || []);
        setAvailability(data.availability || []);
        setError(null);
      } catch (e) {
        console.error("fetchRoomData error:", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-3xl px-4 pb-10">Kraunama...</div>
    );
  }

  if (error || !room) {
    return (
      <div className="mx-auto mt-10 max-w-3xl px-4 pb-10">
        <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 ui-font">
          Nepavyko užkrauti kambario duomenų: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-10 px-4 pb-10">
      <div className="grid gap-8 lg:grid-cols-[3fr,2fr]">
        <div className="space-y-6">
          <RoomGallery images={images} roomName={room.name} />
        </div>

        <RoomInfo room={room} venue={venue} availability={availability} />
      </div>

      <div className="mx-auto flex-c max-w-6xl gap-10 rounded-3xl bg-white p-6 shadow-sm">
        <BookingDateTimePicker
          roomId={room.id}
          durationMinutes={room.duration_minutes}
          bufferMinutes={room.buffer_minutes}
          basePrice={room.price}
          extraHourPrice={room.extra_hour_price}
        />

        {venue && (
          <VenueMap
            name={venue.name}
            address={venue.address}
            city={venue.city || room.city}
            googleMapsUrl={venue.google_maps_url}
            latitude={venue.latitude}
            longitude={venue.longitude}
            zoom={17}
          />
        )}
      </div>
    </div>
  );
}
