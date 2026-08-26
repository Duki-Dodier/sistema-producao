import QRCode from "qrcode";

export async function QrCode({ value }: { value: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return (
    <div
      className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:[shape-rendering:crispEdges]"
      aria-label="QR Code para apontamento da OP"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
