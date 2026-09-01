# Glamour image folder

Drop your own glamour / fashion photos in this folder (JPG or WebP, ideally
1200px or wider on the long edge).

To use them on the demo gallery page (`/glamour-studio`), edit
`src/data/glamour-placeholders.ts` and change each `src` from the Unsplash URL
to a local path, for example:

```ts
{ id: "g1", src: "/images/glamour/my-photo.jpg", title: "…", credit: "Staff photo", tags: ["Studio"] }
```

Files here are served exactly as named, so avoid spaces in filenames.
