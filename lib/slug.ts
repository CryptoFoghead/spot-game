/** URL slug from a game title: lowercase, ascii, hyphen-separated. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Random 4-char suffix used to resolve slug collisions. */
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
