import type { Metadata } from 'next'
import { DecisionConsole } from '@/components/console/DecisionConsole'

export const metadata: Metadata = {
  title: 'Decision Console · Nakshatra-X',
  description:
    'Production shortfall risk and prospectivity for MOIL, with the evidence behind every number.',
}

/** Always server-rendered: the console reads live service-layer state. */
export const dynamic = 'force-dynamic'

export default function ConsolePage() {
  return <DecisionConsole />
}
