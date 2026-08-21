UPDATE public.content_sources
SET active = false, status = 'inactive'
WHERE connector_type IN ('direct_rss','direct_api');

DELETE FROM public.content_sources WHERE name IN (
  'Fremont city coverage','Milpitas city coverage','San Jose city coverage','Cupertino city coverage',
  'Sunnyvale city coverage','Bay Area schools watch','Bay Area transit watch','Bay Area housing watch',
  'South Bay events','San Jose Spotlight','NBC Bay Area','ABC7 Bay Area','Berkeleyside',
  'The Oaklandside','Local News Matters'
);

INSERT INTO public.content_sources
  (name, source_url, rss_url, source_class, connector_type, confidence, cities, topics, frequency_minutes, active, status, notes)
VALUES
  ('Fremont city coverage', 'https://news.google.com', 'https://news.google.com/rss/search?q=%22Fremont%22+California+city+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['fremont'], ARRAY['government'], 120, true, 'healthy', 'Aggregated city search; every card links to the original publisher.'),
  ('Milpitas city coverage', 'https://news.google.com', 'https://news.google.com/rss/search?q=%22Milpitas%22+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['milpitas'], ARRAY['government'], 120, true, 'healthy', NULL),
  ('San Jose city coverage', 'https://news.google.com', 'https://news.google.com/rss/search?q=%22San+Jose%22+city+council+OR+neighborhood+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['san-jose'], ARRAY['government'], 120, true, 'healthy', NULL),
  ('Cupertino city coverage', 'https://news.google.com', 'https://news.google.com/rss/search?q=%22Cupertino%22+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['cupertino'], ARRAY['government'], 120, true, 'healthy', NULL),
  ('Sunnyvale city coverage', 'https://news.google.com', 'https://news.google.com/rss/search?q=%22Sunnyvale%22+California+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['sunnyvale'], ARRAY['government'], 120, true, 'healthy', NULL),
  ('Bay Area schools watch', 'https://news.google.com', 'https://news.google.com/rss/search?q=(Fremont+OR+Milpitas+OR+Cupertino+OR+Sunnyvale)+school+district+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['fremont'], ARRAY['schools'], 240, true, 'healthy', NULL),
  ('Bay Area transit watch', 'https://news.google.com', 'https://news.google.com/rss/search?q=BART+OR+VTA+OR+Caltrain+service+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['san-jose'], ARRAY['transportation'], 180, true, 'healthy', NULL),
  ('Bay Area housing watch', 'https://news.google.com', 'https://news.google.com/rss/search?q=Bay+Area+housing+rent+OR+affordable+when:7d&hl=en-US&gl=US&ceid=US:en', 'reporter', 'direct_rss', 'medium', ARRAY['fremont'], ARRAY['housing'], 240, true, 'healthy', NULL),
  ('South Bay events', 'https://news.google.com', 'https://news.google.com/rss/search?q=(San+Jose+OR+Fremont+OR+Sunnyvale)+festival+OR+event+this+weekend+when:7d&hl=en-US&gl=US&ceid=US:en', 'organizer', 'direct_rss', 'medium', ARRAY['san-jose'], ARRAY['events'], 240, true, 'healthy', NULL),
  ('San Jose Spotlight', 'https://sanjosespotlight.com', 'https://sanjosespotlight.com/feed/', 'reporter', 'direct_rss', 'high', ARRAY['san-jose'], ARRAY['government'], 120, true, 'healthy', 'Nonprofit local newsroom.'),
  ('NBC Bay Area', 'https://www.nbcbayarea.com', 'https://www.nbcbayarea.com/?rss=y', 'reporter', 'direct_rss', 'high', ARRAY[]::text[], ARRAY['public-safety'], 120, true, 'healthy', NULL),
  ('ABC7 Bay Area', 'https://abc7news.com', 'https://abc7news.com/feed/', 'reporter', 'direct_rss', 'high', ARRAY[]::text[], ARRAY['public-safety'], 180, true, 'healthy', NULL),
  ('Berkeleyside', 'https://www.berkeleyside.org', 'https://www.berkeleyside.org/feed', 'reporter', 'direct_rss', 'high', ARRAY[]::text[], ARRAY['community'], 240, true, 'healthy', NULL),
  ('The Oaklandside', 'https://oaklandside.org', 'https://oaklandside.org/feed/', 'reporter', 'direct_rss', 'high', ARRAY[]::text[], ARRAY['community'], 240, true, 'healthy', NULL),
  ('Local News Matters', 'https://localnewsmatters.org', 'https://localnewsmatters.org/feed/', 'reporter', 'direct_rss', 'medium', ARRAY[]::text[], ARRAY['community'], 240, true, 'healthy', NULL);