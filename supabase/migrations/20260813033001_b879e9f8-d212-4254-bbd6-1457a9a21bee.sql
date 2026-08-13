UPDATE public.content_items
SET category = 'cinema'
WHERE status = 'published'
  AND (category IS NULL OR category IN ('news','india-national','india-telangana','india-andhra','india-nri'))
  AND (
    title ~* '(tollywood|bollywood|telugu (film|movie|cinema|actor|actress|hero|heroine)|hindi (film|movie|cinema)|box office|first look|teaser|trailer|movie review|film review|ott release|audio launch|pre-release|biopic)'
    OR coalesce(summary,'') ~* '(tollywood|bollywood|telugu (film|movie|cinema)|box office|first look|teaser|trailer|movie review|ott release)'
    OR coalesce(link_url,'') ~* '(123telugu|gulte|greatandhra|idlebrain|cinejosh|filmibeat|pinkvilla|bollywoodhungama|indiaglitz|koimoi)'
  );