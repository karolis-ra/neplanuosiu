export async function ensurePartnerServiceProvider({ supabase, user }) {
  if (!user?.id) {
    throw new Error("Partneris neprisijungęs.");
  }

  const providerSelect =
    "id, name, description, address, city, email, phone, website, facebook_url, instagram_url, tiktok_url, google_maps_url";

  const { data: existingProvider, error: existingProviderError } =
    await supabase
      .from("service_providers")
      .select(providerSelect)
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

  if (existingProviderError) {
    throw existingProviderError;
  }

  if (existingProvider) {
    return existingProvider;
  }

  const { data: venue } = await supabase
    .from("venues")
    .select(
      "id, name, description, address, city, email, phone, website, google_maps_url, latitude, longitude",
    )
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  const fallbackName =
    venue?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Partnerio paslaugos";

  const payload = {
    id: crypto.randomUUID(),
    owner_id: user.id,
    name: `${fallbackName} paslaugos`,
    description: venue?.description || null,
    address: venue?.address || null,
    city: venue?.city || "Nenurodyta",
    email: venue?.email || user.email || null,
    phone: venue?.phone || null,
    website: venue?.website || null,
    google_maps_url: venue?.google_maps_url || null,
    latitude: venue?.latitude ?? null,
    longitude: venue?.longitude ?? null,
    is_published: true,
  };

  const { data: createdProvider, error: createProviderError } = await supabase
    .from("service_providers")
    .insert(payload)
    .select(providerSelect)
    .single();

  if (createProviderError) {
    throw createProviderError;
  }

  return createdProvider;
}
