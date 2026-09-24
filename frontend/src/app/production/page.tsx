import type { Metadata } from 'next'
import ProductionSentinel from '@/components/mission-control/ProductionSentinel'
import { PageHeader } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Production · Nakshatra-X',
  description:
    'Track B operational detail per mine: conditions, equipment availability and shortfall against plan, each with its provenance.',
}

/** Always server-rendered: this page reads live service-layer state. */
export const dynamic = 'force-dynamic'

export default function ProductionPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Production"
        description="Operational detail for one mine — the conditions and constraints behind its shortfall estimate. Weather is measured; operational figures are synthetic, and each value says which it is."
      />
      <div className="mt-8">
        <ProductionSentinel />
      </div>
    </main>
  )
}
