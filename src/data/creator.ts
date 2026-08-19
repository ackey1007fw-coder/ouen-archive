/**
 * Site creator (制作者) info for the bottom-only mini profile.
 *
 * Fixed constants only — never build hrefs from user input or API
 * responses, and never add an external origin beyond X / GitHub here.
 */
export const CREATOR_DISPLAY_NAME = "あっきー 🌻🌴";

export const CREATOR_DESCRIPTION =
  "5つの応援サイトをつなぎ、活動や夢を見つける入口として、この非公式ファンポータルを制作しています。";

export const CREATOR_X_URL = "https://x.com/ackey_RiRi_supp";

export const CREATOR_GITHUB_URL = "https://github.com/ackey1007fw-coder";

export type CreatorLink = Readonly<{
  id: "x" | "github";
  label: string;
  url: string;
}>;

export const CREATOR_LINKS: readonly CreatorLink[] = [
  { id: "x", label: "X", url: CREATOR_X_URL },
  { id: "github", label: "GitHub", url: CREATOR_GITHUB_URL },
] as const;
