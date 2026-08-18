import { ImageResponse } from "next/og";

export const alt = "OUEN ARCHIVE — Fan-made support portal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#f8f4ed",
        color: "#292722",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 18, marginBottom: 54 }}>
        {["#e89a79", "#49685a", "#e89a79", "#49685a", "#e89a79"].map(
          (color, index) => (
            <span
              key={`${color}-${index}`}
              style={{
                width: 24,
                height: 24,
                display: "flex",
                borderRadius: "50%",
                background: color,
              }}
            />
          ),
        )}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        OUEN ARCHIVE
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 30,
          color: "#68645d",
          fontSize: 27,
          letterSpacing: 5,
          textTransform: "uppercase",
        }}
      >
        Fan-made support portal
      </div>
    </div>,
    size,
  );
}
