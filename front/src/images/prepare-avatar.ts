const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxInputSize = 5 * 1024 * 1024;
const outputSize = 384;
const maxEncodedSize = 750_000;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Cette image ne peut pas être lue."));
    image.src = url;
  });

export async function prepareAvatar(file: File): Promise<string> {
  if (!acceptedTypes.has(file.type))
    throw new Error("Choisis une image JPG, PNG ou WebP.");
  if (file.size > maxInputSize)
    throw new Error("La photo doit peser moins de 5 Mo.");

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 50_000_000
    )
      throw new Error("Les dimensions de cette image sont invalides.");

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("La photo ne peut pas être préparée sur cet appareil.");
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    const avatar = canvas.toDataURL("image/webp", 0.82);
    if (avatar.length > maxEncodedSize)
      throw new Error("La photo compressée reste trop volumineuse.");
    return avatar;
  } finally {
    URL.revokeObjectURL(url);
  }
}
