// The upload a widget's description editor takes (RichTextEditor's
// `upload`), as a TanStack Query mutation over src/api/gateway/files.ts.
// Each call is its own upload: two pictures pasted at once are two
// requests, each resolving to its own address.
import { useMutation } from '@tanstack/react-query'
import type { AppError, ImageUpload, ImageUploadResult } from '@tristan2828/ui-foundation'
import { uploadImage } from '@/api/gateway/files'

export function useUploadImage(): ImageUpload {
  const { mutateAsync } = useMutation<ImageUploadResult, AppError, File>({ mutationFn: uploadImage })
  return mutateAsync
}
