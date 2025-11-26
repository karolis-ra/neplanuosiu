"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getRoomGalleryImages } from "../../lib/roomImageUtils";
import RoomGallery from "@/app/components/room/RoomGallery";
import RoomInfo from "@/app/components/room/RoomInfo";
import BookingDateTimePicker from "../../components/BookingDateTimePicker";

async function fetchRoomData(roomId) {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, venue_id, name, description, price, capacity, duration_minutes, buffer_minutes, min_age, max_age, city"
    )
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    throw new Error(roomError?.message || "Kambarys nerastas");
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, address, city, phone, email, website")
    .eq("id", room.venue_id)
    .single();

  const imageUrls = await getRoomGalleryImages({
    supabase,
    roomId: room.id,
    venueId: room.venue_id,
  });

  return { room, venue, imageUrls };
}

export default function RoomBookingPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [venue, setVenue] = useState(null);
  const [images, setImages] = useState([]);

  useEffect(() => {
    if (!roomId) return;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchRoomData(roomId);
        setRoom(data.room);
        setVenue(data.venue);
        setImages(data.imageUrls || []);
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
    <div className="mx-auto mt-6 max-w-6xl px-4 pb-10 space-y-10">
      <div className="grid lg:grid-cols-[3fr,2fr] gap-8">
        <div className="space-y-6">
          <RoomGallery images={images} roomName={room.name} />
        </div>

        <RoomInfo room={room} venue={venue} />
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm max-w-3xl mx-auto">
        <BookingDateTimePicker
          roomId={room.id}
          durationMinutes={room.duration_minutes}
        />
      </div>
    </div>
  );
}
