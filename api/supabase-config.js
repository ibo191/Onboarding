import { supabaseEnv } from "./_supabase.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    supabaseEnv();
    res.status(200).json({ enabled: true });
  } catch (error) {
    res.status(200).json({ enabled: false, error: error.message });
  }
}
