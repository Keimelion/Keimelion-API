import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'stream'
import { ErrorCode } from '../../shared/enums/error-code.js'

const mockToFile = vi.fn().mockResolvedValue(undefined)
const mockWebp = vi.fn(() => ({ toFile: mockToFile }))
const mockResize = vi.fn(() => ({ webp: mockWebp }))
const mockMetadata = vi.fn().mockResolvedValue({ width: 640, height: 480 })
const mockSharp = vi.fn(() => ({ resize: mockResize, metadata: mockMetadata }))

const mockFileType = vi.fn().mockResolvedValue({ mime: 'image/png', ext: 'png' })

const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockAccess = vi.fn().mockRejectedValue(new Error('ENOENT'))

const mockInsertImage = vi.fn()

vi.mock('sharp', () => ({ default: mockSharp }))
vi.mock('file-type', () => ({ fileTypeFromBuffer: mockFileType }))
vi.mock('fs/promises', () => ({ mkdir: mockMkdir, access: mockAccess }))
vi.mock('../../db/entities/images/images.repository.js', () => ({
  insertImage: mockInsertImage,
}))

const INSERTED_IMAGE = {
  id: '00000000-0000-0000-0000-00000000aaaa',
  hash: 'a'.repeat(64),
  fileKey: 'aa/aa/' + 'a'.repeat(64),
  mime: 'image/png',
  sizeBytes: 100,
  width: 640,
  height: 480,
  uploadedBy: '00000000-0000-0000-0000-000000000001',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const USER_ID = '00000000-0000-0000-0000-000000000001'

describe('processImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToFile.mockResolvedValue(undefined)
    mockWebp.mockReturnValue({ toFile: mockToFile })
    mockResize.mockReturnValue({ webp: mockWebp })
    mockMetadata.mockResolvedValue({ width: 640, height: 480 })
    mockSharp.mockReturnValue({ resize: mockResize, metadata: mockMetadata })
    mockFileType.mockResolvedValue({ mime: 'image/png', ext: 'png' })
    mockMkdir.mockResolvedValue(undefined)
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    mockInsertImage.mockResolvedValue(INSERTED_IMAGE)
  })

  it('returns the inserted image row when the pipeline succeeds', async () => {
    const { processImage } = await import('./image.pipeline.js')
    const result = await processImage(Buffer.from([1, 2, 3, 4]), USER_ID)
    expect('image' in result).toBe(true)
    if ('image' in result) {
      expect(result.image.id).toBe(INSERTED_IMAGE.id)
      expect(result.image.mime).toBe('image/png')
    }
    expect(mockInsertImage).toHaveBeenCalledTimes(1)
    expect(mockToFile).toHaveBeenCalledTimes(3)
  })

  it('rejects empty buffer with INVALID_IMAGE', async () => {
    const { processImage } = await import('./image.pipeline.js')
    const result = await processImage(Buffer.alloc(0), USER_ID)
    expect('errorCode' in result && result.errorCode).toBe(ErrorCode.INVALID_IMAGE)
    expect(mockInsertImage).not.toHaveBeenCalled()
  })

  it('rejects unsupported MIME type with INVALID_IMAGE_TYPE', async () => {
    mockFileType.mockResolvedValueOnce({ mime: 'application/pdf', ext: 'pdf' })
    const { processImage } = await import('./image.pipeline.js')
    const result = await processImage(Buffer.from([1, 2, 3, 4]), USER_ID)
    expect('errorCode' in result && result.errorCode).toBe(ErrorCode.INVALID_IMAGE_TYPE)
  })

  it('rejects sharp decode failure with INVALID_IMAGE', async () => {
    mockMetadata.mockRejectedValueOnce(new Error('bad image'))
    const { processImage } = await import('./image.pipeline.js')
    const result = await processImage(Buffer.from([1, 2, 3, 4]), USER_ID)
    expect('errorCode' in result && result.errorCode).toBe(ErrorCode.INVALID_IMAGE)
  })

  it('rejects buffer larger than the size cap with PAYLOAD_TOO_LARGE', async () => {
    const { processImage } = await import('./image.pipeline.js')
    const oversize = Buffer.alloc(10_000_001)
    const result = await processImage(oversize, USER_ID)
    expect('errorCode' in result && result.errorCode).toBe(ErrorCode.PAYLOAD_TOO_LARGE)
  })

  it('accepts a Readable stream input', async () => {
    const { processImage } = await import('./image.pipeline.js')
    const stream = Readable.from([Buffer.from([1, 2, 3, 4])])
    const result = await processImage(stream, USER_ID)
    expect('image' in result).toBe(true)
  })

  it('aborts stream reads once the size cap is exceeded', async () => {
    const { processImage } = await import('./image.pipeline.js')
    const chunk = Buffer.alloc(5_000_001)
    const stream = Readable.from([chunk, chunk])
    const result = await processImage(stream, USER_ID)
    expect('errorCode' in result && result.errorCode).toBe(ErrorCode.PAYLOAD_TOO_LARGE)
  })

  it('skips writing variants when the file is already present', async () => {
    mockAccess.mockResolvedValue(undefined)
    const { processImage } = await import('./image.pipeline.js')
    const result = await processImage(Buffer.from([1, 2, 3, 4]), USER_ID)
    expect('image' in result).toBe(true)
    expect(mockToFile).not.toHaveBeenCalled()
  })
})
