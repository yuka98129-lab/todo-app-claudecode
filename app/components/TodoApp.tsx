'use client'

import { useState, useEffect, useRef } from 'react'

type Priority = 'high' | 'medium' | 'low'

type Todo = {
  id: string
  text: string
  completed: boolean
  dueDate: string | null // "YYYY-MM-DD" 形式、未設定ならnull
  priority: Priority
}

type SortMode = 'added' | 'priority' | 'due'

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABEL: Record<Priority, string> = { high: '高', medium: '中', low: '低' }
const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'bg-red-50 text-red-600 border-red-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low: 'bg-slate-50 text-slate-500 border-slate-200',
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tomorrowKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 「今日やるべきタスク」かどうかを判定する(期限切れ・本日期限・優先度高のいずれか)
function isTodayFocus(todo: Todo): boolean {
  if (todo.completed) return false
  if (todo.dueDate && todo.dueDate <= todayKey()) return true
  return todo.priority === 'high'
}

// 期限日から「期限切れ / もうすぐ(今日・明日) / 通常」を判定する
function dueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' | null {
  if (!dueDate) return null
  if (dueDate < todayKey()) return 'overdue'
  if (dueDate <= tomorrowKey()) return 'soon'
  return 'normal'
}

function CircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#9ca3af" strokeWidth="2" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path d="M7.5 12l3 3 5-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Web Speech API の型定義（TypeScript 標準 DOM 型に含まれていないため独自定義）
interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
}
interface ISpeechRecognitionEvent {
  results: { [i: number]: { [j: number]: { transcript: string } } }
}
interface ISpeechRecognitionConstructor { new(): ISpeechRecognition }

function getSpeechRecognition(): ISpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: ISpeechRecognitionConstructor
    webkitSpeechRecognition?: ISpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// 未完了タスクをまとめて読み上げ用の自然な文章にする
function buildTodoSpeechText(todos: Todo[]): string {
  const incomplete = todos.filter(t => !t.completed)
  if (incomplete.length === 0) {
    return '未完了のタスクはありません。'
  }

  const overdueCount = incomplete.filter(t => dueDateStatus(t.dueDate) === 'overdue').length
  const overdueText = overdueCount > 0 ? `うち期限切れが${overdueCount}件あります。` : ''
  const items = incomplete.map(t => t.text).join('、')

  return `未完了のタスクが${incomplete.length}件あります。${overdueText}内容は、${items}、です。`
}

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [dueDateInput, setDueDateInput] = useState('')
  const [priorityInput, setPriorityInput] = useState<Priority>('medium')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [todayOnly, setTodayOnly] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [listening, setListening] = useState(false)
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('todos')
      if (stored) {
        // 期限日・優先度を追加する前に保存されたデータにもデフォルト値を補う
        const parsed = JSON.parse(stored) as Partial<Todo>[]
        setTodos(
          parsed.map(t => ({
            id: t.id ?? crypto.randomUUID(),
            text: t.text ?? '',
            completed: t.completed ?? false,
            dueDate: t.dueDate ?? null,
            priority: t.priority ?? 'medium',
          }))
        )
      }
    } catch {
      // ignore corrupt data
    }
    setLoaded(true)
    setSupportsVoice(getSpeechRecognition() !== null)
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos, loaded])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    setTodos(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        dueDate: dueDateInput || null,
        priority: priorityInput,
      },
    ])
    setInput('')
    setDueDateInput('')
    inputRef.current?.focus()
  }

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const API = getSpeechRecognition()
    if (!API) return

    const recognition = new API()
    recognition.lang = 'ja-JP'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => setListening(true)

    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev ? prev + transcript : transcript)
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      inputRef.current?.focus()
    }

    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(buildTodoSpeechText(todos))
    utterance.lang = 'ja-JP'
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const handleStopSpeak = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  if (!loaded) return null

  const completedCount = todos.filter(t => t.completed).length

  // 表示用にソートした配列を作る（元のtodos配列の順序は変えない）
  const sortedTodos = [...todos].sort((a, b) => {
    if (sortMode === 'priority') {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    }
    if (sortMode === 'due') {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
    }
    return 0 // 'added': 追加順のまま(Array#sortは安定ソート)
  })

  // 「今日やるタスクのみ」がONなら、期限切れ・本日期限・優先度高のものだけに絞り込む
  const visibleTodos = todayOnly ? sortedTodos.filter(isTodayFocus) : sortedTodos

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">
          やることリスト
        </h1>

        {/* 入力エリア */}
        <div className="flex gap-2 mb-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder={listening ? '聞き取り中...' : 'やることを入力...'}
            className="flex-1 min-h-[50px] text-base border border-gray-300 rounded-xl px-4
                       focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          />

          {/* 音声入力ボタン */}
          {supportsVoice && (
            <button
              onClick={toggleListening}
              aria-label={listening ? '音声入力を停止' : '音声入力を開始'}
              aria-pressed={listening}
              className={`flex-shrink-0 w-[50px] min-h-[50px] flex items-center justify-center rounded-xl
                          transition-all duration-150 active:scale-95
                          ${listening
                            ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-200'
                            : 'bg-white border border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-400'
                          }`}
            >
              <MicIcon />
            </button>
          )}

          <button
            onClick={addTodo}
            disabled={!input.trim()}
            className="min-w-[72px] min-h-[50px] bg-blue-500 text-white text-base font-medium rounded-xl px-5
                       hover:bg-blue-600 active:scale-95 transition-all duration-100
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            追加
          </button>
        </div>

        {/* 期限日・優先度の設定エリア(新規タスク用) */}
        <div className="flex gap-2 mb-6">
          <input
            type="date"
            value={dueDateInput}
            onChange={e => setDueDateInput(e.target.value)}
            aria-label="期限日(任意)"
            className="flex-1 text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={priorityInput}
            onChange={e => setPriorityInput(e.target.value as Priority)}
            aria-label="優先度"
            className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="high">優先度: 高</option>
            <option value="medium">優先度: 中</option>
            <option value="low">優先度: 低</option>
          </select>
        </div>

        {/* タスクリスト */}
        {todos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-base">タスクはまだありません</p>
            <p className="text-sm mt-1">上から追加してみましょう</p>
          </div>
        ) : (
          <>
            {/* 並び替え・絞り込み・読み上げコントロール */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                aria-label="並び替え"
                className="text-xs text-gray-500 border border-gray-300 rounded-lg px-2 py-1.5 bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="added">追加順</option>
                <option value="priority">優先度順</option>
                <option value="due">期限順</option>
              </select>

              <button
                onClick={() => setTodayOnly(v => !v)}
                aria-pressed={todayOnly}
                className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border
                            active:scale-95 transition-all duration-100
                            ${todayOnly
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'text-gray-500 border-gray-300 hover:bg-gray-100'
                            }`}
              >
                🎯 今日やるタスクのみ
              </button>

              <button
                onClick={speaking ? handleStopSpeak : handleSpeak}
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-300 rounded-lg
                           px-3 py-1.5 hover:bg-gray-100 active:scale-95 transition-all duration-100 ml-auto"
              >
                <SpeakerIcon />
                {speaking ? '読み上げ停止' : 'タスクを読み上げる'}
              </button>
            </div>

            {todayOnly && visibleTodos.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">
                今日やるべきタスクはありません(期限切れ・本日期限・優先度「高」のタスクがあるとここに表示されます)
              </p>
            )}

            <ul className="space-y-2">
              {visibleTodos.map(todo => {
                const status = dueDateStatus(todo.dueDate)
                return (
                  <li
                    key={todo.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm border transition-colors duration-200
                      ${todo.completed ? 'bg-blue-50/40 border-blue-100' : 'bg-white border-gray-100'}`}
                  >
                    {/* 完了トグル */}
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      aria-label={todo.completed ? '未完了に戻す' : '完了にする'}
                      aria-pressed={todo.completed}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center
                                 rounded-full active:scale-90 transition-transform duration-100"
                    >
                      {todo.completed ? <CheckCircleIcon /> : <CircleIcon />}
                    </button>

                    {/* テキスト + バッジ */}
                    <div className="flex-1 min-w-0">
                      <span className={`block text-base leading-snug break-all
                        ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}
                      >
                        {todo.completed && <span className="sr-only">完了済み: </span>}
                        {todo.text}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_CLASS[todo.priority]}`}>
                          優先度: {PRIORITY_LABEL[todo.priority]}
                        </span>
                        {todo.dueDate && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              status === 'overdue'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : status === 'soon'
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            期限: {todo.dueDate}
                            {status === 'overdue' ? '(期限切れ)' : status === 'soon' ? '(もうすぐ)' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 削除ボタン */}
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      aria-label={`「${todo.text}」を削除`}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center
                                 text-gray-300 hover:text-red-400 active:scale-90
                                 transition-all duration-100 rounded-full"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="text-sm text-gray-400 text-center mt-5">
              {completedCount} / {todos.length} 件完了
            </p>
          </>
        )}
      </div>
    </div>
  )
}
