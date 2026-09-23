import { Skeleton } from '@/components/ui/primitives'

/**
 * Root loading state.
 *
 * There was none, while `/loading` existed as a navigable *route* rendering a
 * decorative animation. The route is now a redirect and this is the real state
 * the framework shows during a navigation.
 *
 * It is a skeleton rather than a spinner: a skeleton reserves the space the
 * content will occupy, so the page does not jump when it arrives.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only" role="status">
        Loading
      </p>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => i).map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  )
}
