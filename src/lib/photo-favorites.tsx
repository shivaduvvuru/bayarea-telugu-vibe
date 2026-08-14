import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { Article } from "@/lib/content";

const KEY = "batt-photo-favorites";
const EVENT = "batt-photo-favorites-change";

/** Minimal photo snapshot kept locally so favorites survive feed rotation. */
export type FavoritePhoto = {
  id: number;
  slug: string;
  title: string;
  image: string | null;
  date: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

function read(): FavoritePhoto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as FavoritePhoto[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.slug) : [];
  } catch {
    return [];
  }
}

function write(list: FavoritePhoto[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

function toSnapshot(a: Article | FavoritePhoto): FavoritePhoto {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    image: a.image ?? null,
    date: a.date,
    sourceName: a.sourceName ?? null,
    sourceUrl: a.sourceUrl ?? null,
  };
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Whole favorites list, kept in sync across components and tabs. */
export function useFavoritePhotos() {
  const [list, setList] = useState<FavoritePhoto[]>([]);

  useEffect(() => {
    const sync = () => setList(read());
    sync();
    return subscribe(sync);
  }, []);

  const remove = useCallback((slug: string) => {
    write(read().filter((p) => p.slug !== slug));
  }, []);

  const clear = useCallback(() => write([]), []);

  return { favorites: list, remove, clear };
}

/** Favorite state for one photo. */
export function useFavoritePhoto(article: Article | FavoritePhoto) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const sync = () => setFavorite(read().some((p) => p.slug === article.slug));
    sync();
    return subscribe(sync);
  }, [article.slug]);

  const toggle = useCallback(() => {
    const list = read();
    const exists = list.some((p) => p.slug === article.slug);
    write(exists ? list.filter((p) => p.slug !== article.slug) : [toSnapshot(article), ...list]);
    track("photo_favorite", { slug: article.slug, favorite: !exists });
  }, [article]);

  return { favorite, toggle };
}

/* ------------------------------ disliked photos ----------------------------- */

const HIDDEN_KEY = "batt-photo-hidden";
const HIDDEN_EVENT = "batt-photo-hidden-change";

function readHidden(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(list: string[]) {
  window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new Event(HIDDEN_EVENT));
}

function subscribeHidden(fn: () => void) {
  window.addEventListener(HIDDEN_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(HIDDEN_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** Slugs the reader disliked — dropped from grids on the next refresh. */
export function useHiddenPhotos() {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setHidden(readHidden());
    sync();
    return subscribeHidden(sync);
  }, []);

  const restore = useCallback((slug: string) => {
    writeHidden(readHidden().filter((s) => s !== slug));
  }, []);

  const clear = useCallback(() => writeHidden([]), []);

  return { hidden, restore, clear };
}

/** Dislike state for one photo. Disliking also drops it from favorites. */
export function useHiddenPhoto(article: Article | FavoritePhoto) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sync = () => setHidden(readHidden().includes(article.slug));
    sync();
    return subscribeHidden(sync);
  }, [article.slug]);

  const toggle = useCallback(() => {
    const list = readHidden();
    const exists = list.includes(article.slug);
    writeHidden(exists ? list.filter((s) => s !== article.slug) : [article.slug, ...list]);
    if (!exists) write(read().filter((p) => p.slug !== article.slug));
    track("photo_dislike", { slug: article.slug, hidden: !exists });
  }, [article]);

  return { hidden, toggle };
}

