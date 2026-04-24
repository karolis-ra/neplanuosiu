const BUCKET = "public-images";

export function getServicePublicUrl({ supabase, path }) {
  if (!path) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export function mapServiceImagesWithUrls({ supabase, images }) {
  return (images || []).map((item) => ({
    ...item,
    imageUrl: getServicePublicUrl({
      supabase,
      path: item.path,
    }),
  }));
}
