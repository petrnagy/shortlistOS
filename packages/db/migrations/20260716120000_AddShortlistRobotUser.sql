ALTER TABLE
  "card_comments"
ADD
  COLUMN IF NOT EXISTS "shortlist_isSystem" boolean DEFAULT false NOT NULL;

INSERT INTO
  "user" (
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt"
  )
VALUES
  (
    '00000000-0000-0000-0000-000000000042',
    'shortlistOS Robot',
    'robot@shortlistos.co',
    true,
    '/images/robot_v2.png',
    NOW(),
    NOW()
  ) ON CONFLICT ("id") DO
UPDATE
SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "emailVerified" = EXCLUDED."emailVerified",
  "image" = EXCLUDED."image",
  "updatedAt" = NOW();
