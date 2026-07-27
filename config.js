/* ------------------------------------------------------------------
   Supabase sync — fill these two values in, then re-upload this file.

   Supabase dashboard → Project Settings → API Keys

     SUPABASE_URL       the Project URL, e.g. https://abcdefgh.supabase.co
                        (nothing after ".co")

     SUPABASE_ANON_KEY  the PUBLISHABLE key, starting  sb_publishable_...
                        (older projects: the "anon public" key, starting eyJ)

   NEVER put a secret key here — anything starting sb_secret_, or a JWT
   whose role is service_role. Those bypass Row Level Security, and this
   file is served publicly from GitHub Pages. The app now refuses to run
   with one, but the damage is done the moment it is committed: rotate
   the key rather than just deleting it, because git keeps history.

   Leave both values empty to run the app with no sync at all.
------------------------------------------------------------------- */

window.FL_CONFIG = {
  SUPABASE_URL: "https://kfxlsuurdgwmvnhymuom.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Wk_xyaW7_8SsPwAfqMcO9A_JVUneglq"
};
