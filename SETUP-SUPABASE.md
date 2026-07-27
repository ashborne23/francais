# Turning on sync

Without this, each device keeps its own separate progress. With it, laptop and iPad
share one record and merge cleanly.

## 1. Create the project

Sign up at supabase.com and create a new project (the free tier is enough — this
stores a few kilobytes). Pick a region near you.

## 2. Create the table

Open **SQL Editor** in the Supabase dashboard, paste this, and run it:

```sql
create table public.progress (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "read own row"   on public.progress
  for select using (auth.uid() = user_id);

create policy "insert own row" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "update own row" on public.progress
  for update using (auth.uid() = user_id)
              with check (auth.uid() = user_id);
```

Row Level Security is what makes the public key safe. Without those three policies,
anyone with your key could read and overwrite your data. Do not skip this step.

## 3. Allow your site to sign you in

**Authentication → URL Configuration**

- Site URL: `https://<your-username>.github.io/<repo-name>/`
- Redirect URLs: add the same address

## 4. Paste your keys

**Project Settings → API**. Copy the Project URL and the `anon` `public` key into
`config.js`:

```js
window.FL_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

Never put the `service_role` key in this file. It bypasses every security policy,
and this repository is public.

## 5. Re-upload and sign in

Upload `config.js`, `sync.js`, `index.html` and `sw.js` to the repo. Open the site,
enter your email, and click the link Supabase sends you. Do the same on the iPad.
Both devices are then on the same record.

## How merging works

Local storage stays the source of truth, so the app works offline exactly as before.
When it syncs, the two copies are combined field by field rather than one replacing
the other:

| Data | Rule |
|---|---|
| Daily log | Union by date; the larger minute count for a given date wins |
| Drill scores | Per topic, the higher right and wrong counts win |
| Vocabulary cards | Per card, the higher Leitner box wins |
| Words marked known | Union — anything marked known anywhere stays known |
| Completed units | Union |
| Your own added words | Union by French headword |
| Starting level | Whichever device set it most recently |

It syncs on sign-in, when you leave or hide the page, every two minutes, and when
you press **Sync now**.

## Cost and limits

The free tier covers this many times over. Free-tier Supabase pauses projects after
about a week of inactivity — it wakes on the next request, so a long gap between
study sessions may make the first sync slow. The magic-link emails are rate-limited
on the free tier, but sessions persist, so you sign in rarely.

## If sync fails

The bar says so and nothing is lost. The app keeps writing to the device as it always
has, and the next successful sync merges everything. Export backup still works as a
second safety net.
