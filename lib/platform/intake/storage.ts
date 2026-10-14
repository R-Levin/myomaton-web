// Fail closed if a pilot writer is accidentally aimed at public/canonical storage.
export function intakeStorageSchema(connectionString: string) {
  const options = new URL(connectionString).searchParams.get("options") ?? "";
  const match = /^-c search_path=(canonical_test_[a-f0-9]{32}_intake) -c timezone=UTC$/.exec(options);
  if (!match) throw Error("Dedicated local intake schema required");
  return match[1];
}
