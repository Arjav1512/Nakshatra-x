/**
 * The AI-X assistant's answer engine: a keyword matcher over the written
 * answers in ./chatbot/knowledge. It runs in the browser and calls no model.
 */

import { knowledgeBase, type KnowledgeChunk } from './chatbot/knowledge'
import { askNakshatra, type ChatResult } from './chatbot/engine'

export { knowledgeBase, askNakshatra }
export type { KnowledgeChunk, ChatResult }

/*
 * REMOVED: LOCATION_GEOLOGY_MAP and the branch that answered from it.
 *
 * Any question naming one of fourteen places (Balaghat, Keonjhar, Jaipur…) was
 * answered from a hand-written table: a "Manganese Ore Possibility" of 94.2%,
 * a "Historical Discovery Success Ratio" of 98.4%, a fault distance and an ore
 * grade ("46.2% Mn") per place, and "Highly recommended for exploratory core
 * drilling". None of it came from a model or a measurement; it is the same
 * defect as the map-click "dossier" (docs/design/POLISH_AUDIT.md issue 1),
 * found by the interaction sweep (tools/interaction-sweep.js). A question about
 * a place now gets a written answer or the "no pre-set answer" reply, and the
 * score for a place is on the Track A map, from the model, with provenance.
 */

export function queryAIXKnowledgeBase(query: string, mineName: string, mineCode: string, state: string): ChatResult {
  // 1. The written answers
  const res = askNakshatra(query)
  if (res.matched && res.answer) {
    return res
  }

  // 2. No written answer matches
  return {
    matched: false,
    answer: `I don't have a pre-set answer in my current knowledge base for your question:\n*"${query}"*\n\n` +
      `For immediate contact and fast resolution to your issue, please email our lead development team directly at:\n\n` +
      `📧 **s25cseu1930@bennett.edu.in**\n\n` +
      `Our engineering team will assist you immediately with your query!`,
    category: 'Immediate Support Contact',
    suggestions: knowledgeBase.slice(0, 4).map(k => k),
    actionButton: {
      label: 'Email Support (s25cseu1930@bennett.edu.in)',
      type: 'guidance' as const,
    },
  }
}

export function getAIXAutoSuggestions(input: string): string[] {
  if (!input.trim()) return []

  const clean = input.toLowerCase().trim()
  const matches: string[] = []

  for (const item of knowledgeBase) {
    if (
      item.question.toLowerCase().includes(clean) ||
      item.keywords.some((k) => k.includes(clean))
    ) {
      matches.push(item.question)
    }
  }

  return Array.from(new Set(matches)).slice(0, 5)
}
