import QRCode from "qrcode";

export function Qr({ text }: { text: string }) {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg className="qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label={`QR code for ${text}`}>
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
