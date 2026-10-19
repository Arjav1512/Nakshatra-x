'use client'

import { useState, useRef, useEffect } from 'react'
import type { MineInfo } from './types'
import {
  getAIXAutoSuggestions,
  queryAIXKnowledgeBase
} from '@/lib/aix-knowledge-engine'
import {
  Bot,
  User,
  Send,
  Sparkles,
  X,
  Cpu,
  Zap,
  Search,
} from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  category?: string
  suggestions?: string[]
  actionButton?: {
    label: string
    type: 'blending' | 'dewatering' | 'borehole' | 'risk' | 'guidance'
    data?: any
  }
}

interface Props {
  mine?: MineInfo
  onOpenBlending?: () => void
  onOpenBorehole?: () => void
}


const DEFAULT_MINE: MineInfo = {
  id: 'balaghat',
  numericId: 1,
  name: 'Balaghat Mine',
  code: 'BLG-01',
  state: 'MP',
  lat: 21.8045,
  lng: 80.1852,
  zone: 'Central Pit Alpha',
  targetTonnes: 1200,
  currentProduction: 1140,
}

// Each matches a written answer (src/lib/chatbot/knowledge.ts) by keyword;
// kept short enough to fit the panel on one line.
const STARTER_QUESTIONS = [
  'How does NAKSHATRA-X discover hidden manganese reserves?',
  'What are the main pages and features on the website?',
  'How do we prevent monsoon pit flooding and shortfall?',
  'How does the SciPy Ore Blending Optimization work?',
  'What is the Mine twin page (/mine-twin)?',
  'Who built NAKSHATRA-X and what is SIH Problem Statement 26009?',
]

export default function AICopilotModal({ mine, onOpenBlending, onOpenBorehole }: Props) {

  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for 'open-aix-copilot' custom event triggered by top-right AI-X button
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('open-aix-copilot', handleOpen)
    return () => window.removeEventListener('open-aix-copilot', handleOpen)
  }, [])

  // A modal closes on Escape. This one did not, so the overlay stayed over
  // the page until the close button was found (WCAG 2.1.2).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `Hello! I'm the NAKSHATRA-X assistant. I answer from written notes about the project — its two tracks, its pages, what it measures and what it does not claim. I quote no figures: those are on the console, each with its source. What would you like to know?`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    },
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Handle Input Auto-Suggest Updates
  const handleInputChange = (val: string) => {
    setInput(val)
    if (val.trim().length >= 2) {
      const matched = getAIXAutoSuggestions(val)
      setSuggestions(matched)
      setShowSuggestions(matched.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (suggestedText: string) => {
    setInput(suggestedText)
    setSuggestions([])
    setShowSuggestions(false)
    handleSend(suggestedText)
  }

  const handleSend = (customQuery?: string) => {
    const query = customQuery || input
    if (!query.trim()) return

    setShowSuggestions(false)
    setSuggestions([])

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customQuery) setInput('')
    setIsTyping(true)

    // Execute On-Device RAG Answer Engine
    setTimeout(() => {
      const targetMineName = mine?.name || 'MOIL Central Mining Belt'
      const targetMineCode = mine?.code || 'MOIL-PSU'
      const targetState = mine?.state || 'India'
      const result = queryAIXKnowledgeBase(query, targetMineName, targetMineCode, targetState)

      let replyText = ''
      let suggs: string[] = []
      let category = ''
      let actionBtn = result.actionButton

      if (result.matched && result.answer) {
        replyText = result.answer
        suggs = (result.suggestions || []).map((s: any) => s.question)
        category = result.category || ''
      } else {
        replyText = result.answer || `I don't have a pre-set answer for "${query}".\n\nFor immediate contact and solving your problem, please email our lead engineering team directly at:\n\n📧 s25cseu1930@bennett.edu.in`
        suggs = (result.suggestions || []).map((s: any) => s.question)
        category = 'Immediate Contact'
        actionBtn = {
          label: 'Email Support (s25cseu1930@bennett.edu.in)',
          type: 'guidance',
        }
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        category: category,
        suggestions: suggs,
        actionButton: actionBtn,
      }

      setMessages((prev) => [...prev, botMsg])
      setIsTyping(false)
    }, 500)
  }

  const triggerAction = async (btn: NonNullable<Message['actionButton']>) => {
    if (btn.type === 'dewatering') {
      setMessages((prev) => [
        ...prev,
        {
          id: `act-confirm-${Date.now()}`,
          sender: 'assistant',
          // Was: "✅ Emergency Dispatch Transmitted: Dewatering order sent to
          // pit manager via SCADA Interlock." Nothing was sent — there is no
          // SCADA connection and this system controls no equipment. The blend
          // branch below was corrected for the same reason; this one was
          // found by the interaction sweep (docs/design/POLISH_AUDIT.md).
          // Plain text: messages render as written (whitespace-pre-line), so
          // markdown asterisks would show literally.
          text: `No. Nothing is sent from here: this system has no SCADA connection and controls no equipment (PRD §4 non-goal 2). A forecast shortfall is for a person to act on.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'blending') {
      setMessages((prev) => [
        ...prev,
        {
          id: `act-confirm-${Date.now()}`,
          sender: 'assistant',
          // Was: "Simplex solution dispatched to loader SCADA terminals.
          // Target grade >=42% Mn locked." Nothing here dispatches anything —
          // there is no SCADA integration in this system, and no grade is
          // locked. A chat reply claiming an action was taken is worse than a
          // wrong number, because someone may act on the belief that it was.
          text: `Blending runs on the Blending page (\`/blending\`): set the grade constraints and it returns the least-cost allocation, or says which constraint cannot be met. Nothing is dispatched from there either: applying a plan happens in your own systems.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'borehole') {
      setMessages((prev) => [
        ...prev,
        {
          id: `act-confirm-${Date.now()}`,
          sender: 'assistant',
          text: `Note: this build does not compute kriged block models or UNFC reserve classes. Prospectivity output is decision-support only.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'guidance') {
      if (btn.label?.includes('s25cseu1930') || btn.label?.includes('Email')) {
        window.location.href = 'mailto:s25cseu1930@bennett.edu.in'
      } else {
        // /features is a redirect to the console now; go there directly.
        window.location.href = '/console'
      }
    }
  }

  return (
    <>
      {/* AI-X Copilot Modal Overlay */}
      {isOpen && (
        // A side sheet over a scrim, flat (no shadow), as the reference's
        // surfaces: a 1px line and a tone step separate it from the page.
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-text-primary/20 p-2 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="AI-X assistant"
            className="relative flex h-[660px] max-h-[92vh] w-full flex-col justify-between overflow-hidden rounded-2xl border border-border-strong bg-surface-0 sm:max-w-md md:max-w-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border-default bg-surface-1 p-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-inverse-bg text-inverse-fg">
                  <Cpu className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="text-base leading-none text-text-primary">
                      AI&#8209;X <span className="text-text-secondary">assistant</span>
                    </h3>
                    {/* data-literal-ok: describes how the assistant runs (a local
                        canned-answer matcher in aix-knowledge-engine, no API
                        call), not a measurement of anything. */}
                    <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-sm bg-surface-2 px-2 text-xs tracking-[0.044em] text-text-secondary">
                      Runs on-device
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs tracking-[0.036em] text-text-tertiary">
                    Scope: MOIL manganese mining and space data
                  </p>
                </div>
              </div>

              <button type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary transition-[background-color] duration-[180ms] ease-out hover:bg-surface-3"
                title="Close the AI-X assistant"
                aria-label="Close the AI-X assistant"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Starter questions, as the reference's pill tags. */}
            <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border-default px-4 py-3">
              {STARTER_QUESTIONS.map((q, idx) => (
                <button type="button"
                  key={idx}
                  onClick={() => handleSelectSuggestion(q)}
                  className="inline-flex min-h-[26px] items-center rounded-pill bg-surface-2 px-2.5 py-1 text-left text-xs tracking-[0.036em] text-text-secondary transition-[background-color,color] duration-[180ms] ease-out hover:bg-surface-3 hover:text-text-primary"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area. role="log": a transcript that grows, so a
                screen reader announces new answers as they arrive. */}
            <div role="log" aria-label="Conversation" className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'assistant' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}

                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={`rounded-xl p-3.5 ${
                        m.sender === 'user'
                          ? 'rounded-br-sm bg-inverse-bg text-inverse-fg'
                          : 'rounded-bl-sm bg-surface-2 text-text-primary'
                      }`}
                    >
                      {m.category && (
                        <div className="label mb-1">
                          {m.category}
                        </div>
                      )}
                      <div className="whitespace-pre-line leading-relaxed">{m.text}</div>

                      {/* In-Line Related Suggestions */}
                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border-default flex flex-wrap gap-1.5">
                          {m.suggestions.map((s, idx) => (
                            <button type="button"
                              key={idx}
                              onClick={() => handleSelectSuggestion(s)}
                              className="inline-flex min-h-[26px] items-center rounded-pill bg-surface-0 px-2.5 py-1 text-left text-xs tracking-[0.036em] text-text-secondary transition-[background-color,color] duration-[180ms] ease-out hover:bg-surface-3 hover:text-text-primary"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`mt-1.5 text-right font-mono text-xs ${
                          m.sender === 'user' ? 'text-inverse-fg/75' : 'text-text-tertiary'
                        }`}
                      >
                        {m.timestamp}
                      </div>
                    </div>

                    {/* Action Button inside message */}
                    {m.actionButton && (
                      <button type="button"
                        onClick={() => triggerAction(m.actionButton!)}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-inverse-bg px-3 text-[14px] tracking-[0.044em] text-inverse-fg transition-[background-color,scale] duration-[180ms] ease-out hover:bg-inverse-hover active:scale-[.97]"
                      >
                        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{m.actionButton.label}</span>
                      </button>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <User className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl bg-surface-2 p-3" role="status">
                    <span className="sr-only">AI-X is answering</span>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* DYNAMIC AUTO-SUGGEST DROPDOWN OVERLAY */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-[76px] left-3 right-3 z-50 rounded-lg border border-border-strong bg-surface-0 p-1.5">
                <div className="label mb-1 flex items-center gap-1.5 border-b border-border-default px-3 pb-2 pt-1">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>Suggested questions</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button type="button"
                      key={idx}
                      onClick={() => handleSelectSuggestion(item)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-primary transition-[background-color] duration-[180ms] ease-out hover:bg-surface-2"
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            {/* The reference's prompt bar: a surface field with its action inside. */}
            <div className="relative border-t border-border-default p-3 sm:p-4">
              <div className="flex items-center gap-2 rounded-xl bg-surface-2 py-1.5 pl-4 pr-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => input.trim().length >= 2 && setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend()
                  if (e.key === 'Escape') setShowSuggestions(false)
                }}
                placeholder={`Ask anything about Nakshatra-X…`}
                aria-label="Ask AI-X a question"
                className="min-w-0 flex-1 bg-transparent py-2 text-base text-text-primary focus:outline-none"
              />
              <button type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                aria-label="Send"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-inverse-bg text-inverse-fg transition-[background-color,scale] duration-[180ms] ease-out hover:bg-inverse-hover active:scale-[.97] disabled:opacity-35"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
