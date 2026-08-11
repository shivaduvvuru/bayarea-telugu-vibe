/** Business-owner claims on directory listings. */
export type DirectoryClaim = {
  id: string;
  listing_id: number;
  listing_title: string;
  claimant_name: string;
  claimant_email: string;
  claimant_phone: string | null;
  claimant_role: string | null;
  city: string | null;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export const CLAIM_COLUMNS =
  "id, listing_id, listing_title, city, address, hours, website, phone, status, created_at";

/** Public view of an approved correction, applied over the stored listing. */
export type ClaimOverride = {
  listing_id: number;
  city: string | null;
  address: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
};
