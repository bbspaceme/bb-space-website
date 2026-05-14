-- Migration: Add role claims to JWT
-- File: supabase/migrations/20260512_add_role_to_jwt.sql

-- Keep auth.users.raw_app_meta_data.roles in sync with user_roles changes.
-- This trigger runs on user_roles rows, so it must target NEW.user_id/OLD.user_id
-- and explicitly UPDATE auth.users. Mutating NEW.raw_app_meta_data here would only
-- mutate the user_roles row and would not update JWT app metadata.
CREATE OR REPLACE FUNCTION sync_user_roles_to_jwt()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  role_claims JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(role ORDER BY role), '[]'::jsonb)
  INTO role_claims
  FROM user_roles
  WHERE user_id = target_user_id;

  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{roles}',
    role_claims,
    true
  )
  WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_role_change ON user_roles;
DROP FUNCTION IF EXISTS add_role_to_jwt();
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION sync_user_roles_to_jwt();

-- Update existing users' JWT claims
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{roles}',
  COALESCE(
    (SELECT jsonb_agg(role ORDER BY role) FROM user_roles WHERE user_id = auth.users.id),
    '[]'::jsonb
  ),
  true
);
