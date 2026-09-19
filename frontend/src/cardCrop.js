export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('Could not load that image.')))
    image.src = src
  })
}

export async function cropImageToFile(imageSrc, pixelCrop, fileName = 'card.jpg') {
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

  canvas.width = sourceWidth
  canvas.height = sourceHeight
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
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
      0.92,
    )
  })

  return new File([blob], fileName, { type: 'image/jpeg' })
}

export function paintCropPreview(image, pixelCrop, canvas) {
  const context = canvas.getContext('2d')
  if (!context || !pixelCrop) {
    return
  }

  const width = Math.max(1, Math.round(pixelCrop.width))
  const height = Math.max(1, Math.round(pixelCrop.height))
  const sourceX = Math.max(0, Math.round(pixelCrop.x))
  const sourceY = Math.max(0, Math.round(pixelCrop.y))
  const sourceWidth = Math.min(width, image.naturalWidth - sourceX)
  const sourceHeight = Math.min(height, image.naturalHeight - sourceY)

  canvas.width = sourceWidth
  canvas.height = sourceHeight
  context.clearRect(0, 0, sourceWidth, sourceHeight)
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  )
}
