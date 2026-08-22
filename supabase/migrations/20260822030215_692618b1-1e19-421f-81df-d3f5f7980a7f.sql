with v(slug, address, phone, website, lat, lng) as (values
 ('alexanders-steakhouse-cupertino','19379 Stevens Creek Blvd, Cupertino, CA 95014','+1-408-446-2222','https://alexanderssteakhouse.com/cupertino/',37.3229,-122.0117),
 ('cafe-colucci-oakland','5849 San Pablo Ave, Oakland, CA 94608','+1-510-923-9958','https://cafecolucci.com/',37.8447,-122.2799),
 ('chaat-bhavan-fremont','5355 Mowry Ave, Fremont, CA 94538','+1-408-773-1100','https://www.chaatbhavan.com/',37.5297,-121.9791),
 ('curry-truck-mobile-san-jose','3250 Zanker Rd #30, San Jose, CA 95134','+1-408-539-0200','https://www.curryupnow.com/san-jose',37.4067,-121.9366),
 ('de-afghanan-fremont','37405 Fremont Blvd, Fremont, CA 94536','+1-510-745-9599','https://deafghanan.com/',37.5476,-121.9895),
 ('dyafa-oakland','44 Webster St, Oakland, CA 94607','+1-510-250-9491','https://www.dyafaoakland.com/',37.7963,-122.2795),
 ('izzys-brooklyn-bagels-palo-alto','477 S California Ave, Palo Alto, CA 94306','+1-650-329-0700','https://www.izzysbrooklynbagels.com/',37.4245,-122.1436),
 ('jang-su-jang-santa-clara','3561 El Camino Real #10, Santa Clara, CA 95051','+1-408-246-1212','https://www.jangsujang.com/',37.3562,-121.9803),
 ('la-vic-san-jose','140 E San Carlos St, San Jose, CA 95112','+1-408-298-5335','https://www.lavicsj.com/',37.3324,-121.8862),
 ('oren-hummus-palo-alto','261 University Ave, Palo Alto, CA 94301','+1-650-752-6492','https://orenshummus.com/locations/restaurants/palo-alto/',37.4460,-122.1608),
 ('paradise-biryani-santa-clara','2961 El Camino Real, Santa Clara, CA 95051','+1-408-564-7876','https://cabiryani.com/',37.3552,-121.9846),
 ('philz-coffee-sunnyvale','125 S Frances St, Sunnyvale, CA 94086','+1-408-636-2907','https://philzcoffee.com/locations/sunnyvale',37.3773,-122.0328),
 ('pho-kim-long-san-jose','2082 N Capitol Ave, San Jose, CA 95132','+1-408-946-2181','https://www.phokimlongsanjose.com/',37.3934,-121.8434),
 ('saravana-bhavan-sunnyvale','1305 S Mary Ave, Sunnyvale, CA 94087','+1-408-773-8677',null,37.3496,-122.0119),
 ('scomas-sausalito','588 Bridgeway, Sausalito, CA 94965','+1-415-332-9551','https://www.scomassausalito.com/',37.8586,-122.4831),
 ('shalimar-fremont','3325 Walnut Ave, Fremont, CA 94538','+1-510-494-1919','https://shalimarfremont.com/',37.5555,-121.9769),
 ('smoking-pig-bbq-san-jose','1144 N 4th St, San Jose, CA 95112','+1-408-380-4784','https://www.smokingpigbbq.net/',37.3540,-121.8944),
 ('super-duper-burgers-sf','721 Market St, San Francisco, CA 94103','+1-415-538-3437','https://www.superduperburgers.com/',37.7864,-122.4058),
 ('sushi-tomi-mountain-view','635 W Dana St, Mountain View, CA 94041','+1-650-961-3800','https://sushitomi.us/',37.3897,-122.0846),
 ('terun-palo-alto','448 California Ave, Palo Alto, CA 94306','+1-650-600-8310','https://www.terunpizza.com/',37.4287,-122.1425),
 ('zachary-pizza-berkeley','1853 Solano Ave, Berkeley, CA 94707','+1-510-525-5950','https://zacharys.com/locations/north-berkeley/',37.8917,-122.2833)
)
update public.restaurants r
set address = v.address,
    phone = v.phone,
    website_url = coalesce(v.website, r.website_url),
    latitude = v.lat,
    longitude = v.lng,
    verified = true,
    last_refreshed_at = now(),
    updated_at = now()
from v where r.slug = v.slug;

update public.restaurants r
set reservation_url = 'https://www.opentable.com/r/saravana-bhavan-sunnyvale'
where r.slug = 'saravana-bhavan-sunnyvale';

with c(city, lat, lng) as (values
 ('San Jose',37.3382,-121.8863),('Santa Clara',37.3541,-121.9552),('Sunnyvale',37.3688,-122.0363),
 ('Milpitas',37.4323,-121.8996),('Cupertino',37.3230,-122.0322),('Fremont',37.5485,-121.9886),
 ('Hayward',37.6688,-122.0808),('San Ramon',37.7799,-121.9780),('Oakland',37.8044,-122.2712),
 ('Berkeley',37.8715,-122.2730),('Mountain View',37.3861,-122.0839),('Palo Alto',37.4419,-122.1430),
 ('San Francisco',37.7749,-122.4194),('Sausalito',37.8591,-122.4853)
)
update public.restaurants r
set latitude = c.lat, longitude = c.lng, updated_at = now()
from c
where r.city = c.city and r.latitude is null;