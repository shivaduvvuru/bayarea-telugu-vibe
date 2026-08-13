UPDATE public.content_items SET category = CASE
  WHEN (coalesce(title,'')||' '||coalesce(summary,'')) ~* '(h ?-?1b|\yh4\y|green card|priority date|visa bulletin|uscis|immigrat|consular|visa (interview|appointment|fee|denial|rules?)|\yopt\y|\yead\y|naturaliz|deportat|asylum)' THEN 'india-immigration'
  WHEN (coalesce(title,'')||' '||coalesce(summary,'')) ~* '(telangana|hyderabad|warangal|karimnagar|nizamabad|khammam|\ybrs\y|\ykcr\y|revanth)' THEN 'india-telangana'
  WHEN (coalesce(title,'')||' '||coalesce(summary,'')) ~* '(andhra|amaravati|vijayawada|visakhapatnam|vizag|guntur|tirupati|kurnool|nellore|rajahmundry|\ytdp\y|ysrcp|jagan|chandrababu|pawan kalyan)' THEN 'india-andhra'
  WHEN (coalesce(title,'')||' '||coalesce(summary,'')) ~* '(\ynri\y|\yoci\y|\ypio\y|diaspora|indian[ -]american|indians in (the )?(us|usa|america)|remittance|pravasi|india abroad)' THEN 'india-nri'
  WHEN coalesce(link_url,'') ~* '(indiatimes|thehindu|ndtv|indiatoday|outlookindia|theweek\.in|frontline|indiawest|newindiaabroad|americanbazaar|murthy\.com|immigration\.com|uscis\.gov|indianembassy|cgisf)'
    OR (coalesce(title,'')||' '||coalesce(summary,'')) ~* '(\yindia\y|\yindian\y|new delhi|\ymodi\y|lok sabha|rupee|\ybharat\y)' THEN 'india-national'
  ELSE category END
WHERE kind = 'news' AND (category IS NULL OR category = 'news');