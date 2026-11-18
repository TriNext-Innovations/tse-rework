import Image from 'next/image'

// The slot for a real photograph of the Kya Sands premises or the team (#478).
//
// Empty on purpose. Every product image on this store is supplier stock, and an
// about page illustrated with stock undermines the one thing it is for:
// proving the shop is real. So until the client supplies a photo of their own
// premises, this renders nothing and the page is designed to stand without it.
//
// To add the photo: put the file in apps/web/public/about/ and set
// PREMISES_PHOTO below. Nothing else on the page needs to change.
//
// TODO(tnx): waiting on the client for a premises/team photograph.

export type PremisesPhotoSource = {
  /** Root-relative path under /public, e.g. '/about/premises.jpg'. */
  src: string
  /** Describe what is in the picture — the counter, the unit front, the team. */
  alt: string
  width: number
  height: number
  /** Optional caption shown under the image. */
  caption?: string
}

export const PREMISES_PHOTO: PremisesPhotoSource | null = null

export function PremisesPhoto({ photo = PREMISES_PHOTO }: { photo?: PremisesPhotoSource | null }) {
  if (!photo) return null
  return (
    <figure className="mt-10" data-testid="premises-photo">
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes="(min-width: 768px) 768px, 100vw"
        className="w-full h-auto rounded-[16px] border border-[var(--line-3)]"
      />
      {photo.caption ? (
        <figcaption className="mt-2 text-xs text-[var(--muted)]">{photo.caption}</figcaption>
      ) : null}
    </figure>
  )
}
