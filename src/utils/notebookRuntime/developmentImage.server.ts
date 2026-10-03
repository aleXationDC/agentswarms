export function developmentRuntimeImage(env: Record<string, string | undefined> = process.env) {
  const image = env.AXTN_DEVELOPMENT_RUNTIME_IMAGE;
  if (!image || !/^sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error("An exact protected Development Runtime image is required");
  }
  return image;
}
