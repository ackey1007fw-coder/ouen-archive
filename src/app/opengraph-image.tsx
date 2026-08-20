import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  OG_ACCENT_HEIGHT,
  OG_BAND_HEIGHT,
  OG_HEIGHT,
  OG_PORTRAITS,
  OG_STRIP_HEIGHT,
  OG_WIDTH,
} from "@/lib/og-portraits";

export const alt =
  "応援アーカイブ｜夢と活動の記録 — 三橋莉子・吉井優花子・夏凪里季・伊東千鶴のポートレートを並べたシェア画像";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

// The crops do not depend on request data, so they are read once at module
// scope and inlined as data URIs (ImageResponse cannot read from `public/`).
const portraits = await Promise.all(
  OG_PORTRAITS.map(async (portrait) => {
    const data = await readFile(
      join(process.cwd(), "assets/og-portraits", portrait.file),
      "base64",
    );
    return { ...portrait, src: `data:image/jpeg;base64,${data}` };
  }),
);

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f8f4ed",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", height: OG_STRIP_HEIGHT }}>
        {portraits.map((portrait) => (
          <img
            key={portrait.personId}
            src={portrait.src}
            width={portrait.width}
            height={OG_STRIP_HEIGHT}
            style={{ objectFit: "cover" }}
            alt=""
          />
        ))}
      </div>

      <div style={{ display: "flex", height: OG_ACCENT_HEIGHT }}>
        <div style={{ display: "flex", flex: 1, background: "#e89a79" }} />
        <div style={{ display: "flex", flex: 1, background: "#49685a" }} />
      </div>

      <div
        style={{
          height: OG_BAND_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 56px",
          background: "#2c3a33",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 86,
            color: "#f8f4ed",
            letterSpacing: -1,
          }}
        >
          応援アーカイブ
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: "#d8e2db", letterSpacing: 5 }}>
            夢と活動の記録
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 18,
              color: "#e89a79",
              letterSpacing: 4,
            }}
          >
            FAN-MADE SUPPORT PORTAL
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
