import QRCode from "qrcode";

/**
 * QR rendered on demand as an inline data URI (PRD §21) — nothing stored.
 */
export async function RoomQRCode({
  joinUrl,
  size = 220,
}: {
  joinUrl: string;
  size?: number;
}) {
  const dataUrl = await QRCode.toDataURL(joinUrl, {
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`QR code to join at ${joinUrl}`}
      width={size}
      height={size}
      className="rounded-lg border bg-white"
    />
  );
}
