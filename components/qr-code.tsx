import QRCode from "qrcode";

export async function QrCode({ value }: { value: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return (
    <div
      className="h-full w-full"
      aria-label="QR Code para apontamento da OP"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
