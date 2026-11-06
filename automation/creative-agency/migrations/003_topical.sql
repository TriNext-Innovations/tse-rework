-- Topical posts: an assignment that winks at a big news story of the week.
-- NULL = an ordinary post. '{}' = topical, story not chosen yet (it is chosen
-- close to the slot so the news is fresh). After the news editor runs it holds
-- the chosen story and the hidden angle, or {"none": reason} when no story was
-- safe and big enough, in which case the post is made as an ordinary one.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS topical jsonb;
