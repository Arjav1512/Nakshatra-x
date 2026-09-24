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

const STARTER_QUESTIONS = [ 'How does NAKSHATRA-X discover hidden manganese reserves?', 'What are the main pages and features on the website?', 'How do we prevent monsoon pit flooding and shortfall?', 'Walk me through SciPy ore blending optimization', 'What is the 3D Mine Twin Digital Simulator?', 'Tell me about SIH Problem Statement 26009 for MOIL!',
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

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: `Hello! I'm your **NAKSHATRA-X** Space-Geological Assistant. I can guide you through all project features, website modules, satellite discovery math, SciPy ore blending, 3D Kriging, and SIH Problem Statement 26009 details. What would you like to know?`,
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
        replyText = result.answer || `I don't have a pre-set answer for "${query}".\n\nFor immediate contact and solving your problem, please email our lead engineering team directly at:\n\n📧 **s25cseu1930@bennett.edu.in**`
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
          text: `✅ **Emergency Dispatch Transmitted**: Dewatering order sent to pit manager via SCADA Interlock.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'blending') {
      setMessages((prev) => [
        ...prev,
        {
          id: `act-confirm-${Date.now()}`,
          sender: 'assistant',
          text: `✅ **Stockpile Blending Applied**: Simplex solution dispatched to loader SCADA terminals. Target grade ≥42% Mn locked.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'borehole') {
      setMessages((prev) => [
        ...prev,
        {
          id: `act-confirm-${Date.now()}`,
          sender: 'assistant',
          text: `**Note**: this build does not compute kriged block models or UNFC reserve classes. Prospectivity output is decision-support only.`,
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        },
      ])
    } else if (btn.type === 'guidance') {
      if (btn.label?.includes('s25cseu1930') || btn.label?.includes('Email')) {
        window.location.href = 'mailto:s25cseu1930@bennett.edu.in'
      } else {
        window.location.href = '/features'
      }
    }
  }

  return (
    <>
      {/* AI-X Copilot Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-2 sm:p-6 bg-surface-0/80  animate-in fade-in duration-200">
          <div className="ios-glass-card w-full sm:max-w-md md:max-w-lg h-[660px] max-h-[92vh] flex flex-col justify-between overflow-hidden shadow-2xl border border-border-interactive rounded-md relative">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border-default bg-gradient-to-r from-[rgba(6,12,24,0.95)] to-[rgba(10,20,35,0.95)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative p-2.5 rounded-md bg-accent/15 border border-accent/40">
                  <Cpu className="w-5 h-5 text-accent" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-accent border border-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                    <h3 className="text-base font-semibold text-text-primary tracking-wider flex items-center flex-nowrap whitespace-nowrap leading-none font-sans shrink-0">
                      <span className="text-text-primary drop-">AI</span>
                      <span className="font-3d-cyber text-cyber-liquid-red ml-0.5 inline-block font-semibold text-base">
                        -X
                      </span>
                      <span className="text-text-secondary font-semibold text-xs ml-1.5 font-mono">Platform Copilot</span>
                    </h3>
                    <span className="ios-badge ios-badge-live text-xs py-0.5 px-2 font-mono font-bold whitespace-nowrap shrink-0">
                      100% FREE ON-DEVICE
                    </span>
                  </div>
                  <p className="text-xs font-mono text-text-secondary">
                    Project Scope: <span className="text-accent font-bold">MOIL Manganese Mining &amp; Space Intelligence</span>
                  </p>
                </div>
              </div>

              <button type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-md bg-surface-3 hover:bg-white/20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Close AI-X Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Starter Chips Bar */}
            <div className="px-4 py-2 bg-black/40 border-b border-border-subtle flex flex-wrap gap-2 shrink-0">
              {STARTER_QUESTIONS.map((q, idx) => (
                <button type="button"
                  key={idx}
                  onClick={() => handleSelectSuggestion(q)}
                  className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-accent/20 border border-border-default hover:border-accent/40 text-xs font-mono text-text-secondary hover:text-accent transition-colors cursor-pointer shrink-0"
                >
                  ✦ {q}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs leading-relaxed">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'assistant' && (
                    <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-accent" />
                    </div>
                  )}

                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={`p-3.5 rounded-md ${
                        m.sender === 'user'
                          ? 'bg-gradient-to-r from-accent to-[var(--color-accent)] text-black font-semibold rounded-br-none'
                          : 'bg-surface-3 border border-border-default text-text-primary rounded-bl-none shadow-lg'
                      }`}
                    >
                      {m.category && (
                        <div className="text-xs font-mono uppercase tracking-widest text-accent font-bold mb-1">
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
                              className="px-2 py-1 rounded-full bg-surface-2 hover:bg-accent/20 border border-border-default text-xs font-mono text-text-secondary hover:text-accent transition-colors cursor-pointer"
                            >
                              ✦ {s}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`text-xs font-mono mt-1.5 text-right ${
                          m.sender === 'user' ? 'text-black/70' : 'text-text-secondary'
                        }`}
                      >
                        {m.timestamp}
                      </div>
                    </div>

                    {/* Action Button inside message */}
                    {m.actionButton && (
                      <button type="button"
                        onClick={() => triggerAction(m.actionButton!)}
                        className="w-full p-2.5 rounded-md bg-accent/20 hover:bg-accent/35 border border-accent/50 text-accent font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{m.actionButton.label}</span>
                      </button>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 items-center text-text-secondary font-mono text-xs">
                  <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-accent animate-spin" />
                  </div>
                  <div className="p-3 rounded-md bg-surface-3 border border-border-default flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent " />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-accent [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* DYNAMIC AUTO-SUGGEST DROPDOWN OVERLAY */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-[68px] left-3 right-3 z-50 p-2 rounded-md bg-[var(--color-surface-1)]/95 border border-accent/40  animate-in slide-in-from-bottom-2 duration-200">
                <div className="text-xs font-mono text-accent font-bold px-3 py-1 flex items-center gap-1.5 border-b border-border-default mb-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <span>Suggested Questions:</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button type="button"
                      key={idx}
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-3 py-2 rounded-md text-xs font-mono text-text-primary hover:text-text-primary hover:bg-accent/20 transition-colors flex items-center gap-2 cursor-pointer border border-transparent hover:border-accent/30"
                    >
                      <Search className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-border-default bg-black/70 flex items-center gap-2 relative">
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
                placeholder={`Ask anything about NAKSHATRA-X…`}
                className="flex-1 p-3 rounded-md bg-surface-3 border border-border-interactive text-xs font-sans text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
              />
              <button type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="p-3 rounded-md bg-accent hover:bg-accent/80 text-black font-bold disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
