import wasm from 'libheif-js/libheif-wasm/libheif.wasm'
import factory from 'libheif-js/libheif-wasm/libheif.js'
import { fit, type Raster } from './raster'
// HEIC/HEIF photos (an iPhone's default) are decoded in the Worker with libheif (LGPL-3.0, its own WebAssembly module).
// Each decode gets a fresh instance so the decoder's memory is released with it, and the picture is reduced while it is
// copied out of that memory, so a 12-megapixel photo never needs a full-size copy in JavaScript.
type Heif = any
async function instance(): Promise<Heif> {
 // The glue takes its Node.js branch under nodejs_compat and reads __dirname there; the module itself is supplied below.
 ;(globalThis as { __dirname?: string }).__dirname ??= '/'
 return factory({ instantiateWasm(imports: WebAssembly.Imports, done: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) { const i = new WebAssembly.Instance(wasm, imports); done(i, wasm); return i.exports } })
}
export async function heic(bytes: Uint8Array): Promise<Raster> {
 const lib = await instance(), context = lib.heif_context_alloc()
 try {
  const read = lib.heif_context_read_from_memory(context, bytes)
  if (read.code !== lib.heif_error_code.heif_error_Ok) throw new Error(`heic_unreadable: ${read.message}`)
  const handle = lib.heif_js_context_get_primary_image_handle(context)
  if (!handle || handle.code) throw new Error('heic_no_image')
  const image = await lib.heif_js_decode_image2(handle, lib.heif_colorspace.heif_colorspace_RGB, lib.heif_chroma.heif_chroma_interleaved_RGB)
  if (!image || image.code) throw new Error('heic_decode_failed')
  try {
   const plane = image.channels.find((c: any) => c.id === lib.heif_channel.heif_channel_interleaved)
   return fit({ width: plane.width, height: plane.height, channels: 3, stride: plane.stride, data: plane.data })
  } finally { lib.heif_image_release(image.image); lib.heif_image_handle_release(handle) }
 } finally { lib.heif_context_free(context) }
}
