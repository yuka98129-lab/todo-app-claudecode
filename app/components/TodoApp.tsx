'use client'

import { useState, useEffect, useRef } from 'react'

type Todo = {
  id: string
  text: string
  completed: boolean
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

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('todos')
      if (stored) setTodos(JSON.parse(stored))
    } catch {
      // ignore corrupt data
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos, loaded])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    setTodos(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }])
    setInput('')
    inputRef.current?.focus()
  }

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  if (!loaded) return null

  const completedCount = todos.filter(t => t.completed).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">
          やることリスト
        </h1>

        {/* 入力エリア */}
        <div className="flex gap-2 mb-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="やることを入力..."
            className="flex-1 min-h-[50px] text-base border border-gray-300 rounded-xl px-4
                       focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          />
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

        {/* タスクリスト */}
        {todos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-base">タスクはまだありません</p>
            <p className="text-sm mt-1">上から追加してみましょう</p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {todos.map(todo => (
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

                  {/* テキスト */}
                  <span className={`flex-1 text-base leading-snug break-all
                    ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}
                  >
                    {todo.completed && <span className="sr-only">完了済み: </span>}
                    {todo.text}
                  </span>

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
              ))}
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
