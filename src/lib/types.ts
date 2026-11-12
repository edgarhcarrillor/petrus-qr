import type { ContentKind, PageRef } from "./constants";

export type QrCode = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_active: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type QrVersion = {
  id: string;
  qr_id: string;
  kind: ContentKind;
  link_url: string | null;
  body: string | null;
  original_path: string | null;
  original_name: string | null;
  pages: PageRef[];
  searchable: boolean;
  index_path: string | null;
  created_at: string;
};
