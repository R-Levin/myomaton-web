-- Preserve revoked rows, keys, deliveries and audit references.
CREATE UNIQUE INDEX wordpress_installation_active_origin
  ON wordpress_installations(origin) WHERE status = 'active';
ALTER TABLE wordpress_installations DROP CONSTRAINT wordpress_installation_origin;
