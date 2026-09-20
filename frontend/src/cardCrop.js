export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Could not load that image.')))
    image.src = src
  })
}

export async function cropImageToFile(
  imageSrc,
  pixelCrop,
  fileName = 'card.jpg',
  { maxSide = 1200, quality = 0.75 } = {},
) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not crop this image.')
  }

  const width = Math.max(1, Math.round(pixelCrop.width))
  const height = Math.max(1, Math.round(pixelCrop.height))
  const sourceX = Math.max(0, Math.round(pixelCrop.x))
  const sourceY = Math.max(0, Math.round(pixelCrop.y))
  const sourceWidth = Math.min(width, image.naturalWidth - sourceX)
  const sourceHeight = Math.min(height, image.naturalHeight - sourceY)
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
  const destWidth = Math.max(1, Math.round(sourceWidth * scale))
  const destHeight = Math.max(1, Math.round(sourceHeight * scale))

  canvas.width = destWidth
  canvas.height = destHeight
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    destWidth,
    destHeight,
  )

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob)
        } else {
          reject(new Error('Could not crop this image.'))
        }
      },
      'image/jpeg',
      quality,
    )
  })

  return new File([blob], fileName, { type: 'image/jpeg' })
}

