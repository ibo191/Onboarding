const PLACE_ID = "ChIJPwC0m8rtC0cRkIuhQPbMRV4";

function toReview(review) {
  return {
    name: review.author_name || "Student Autoškoly BuBu",
    place: "Google",
    text: review.text || "",
    rating: Number(review.rating || 0),
    relativeTime: review.relative_time_description || "",
    profilePhoto: review.profile_photo_url || "",
    url: review.author_url || "",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GOOGLE_PLACES_API_KEY" });
    return;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", PLACE_ID);
  url.searchParams.set("fields", "name,rating,user_ratings_total,reviews,url");
  url.searchParams.set("language", "cs");
  url.searchParams.set("reviews_sort", "most_relevant");
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status !== "OK") {
      res.status(502).json({ error: "Google Places request failed", status: data.status, message: data.error_message });
      return;
    }

    const result = data.result || {};
    const reviews = (result.reviews || [])
      .map(toReview)
      .filter((review) => review.rating === 5 && review.text.trim().length > 0)
      .slice(0, 5);

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json({
      placeId: PLACE_ID,
      name: result.name || "Autoškola BuBu",
      rating: result.rating || null,
      total: result.user_ratings_total || null,
      googleUrl: result.url || "",
      reviews,
    });
  } catch (error) {
    res.status(500).json({ error: "Unable to load Google reviews" });
  }
};
