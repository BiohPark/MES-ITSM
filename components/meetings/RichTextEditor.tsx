'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      TaskList.configure({}),
      TaskItem.configure({}),
      Highlight,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    // Next.js SSR 환경에서 수화(hydration) 불일치 방지
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
  })

  // 외부에서 value가 바뀐 경우(기존 회의록 불러오기 등) 에디터 내용도 동기화
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(value)
    }
    if (!value && current !== '<p></p>') {
      editor.commands.setContent('')
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div>
      {/* 툴바 */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          border: '1px solid #d1d5db',
          borderRadius: '4px 4px 0 0',
          padding: '0.25rem 0.5rem',
          backgroundColor: '#f9fafb',
        }}
      >
        {/* 인라인 스타일 */}
        {/* 인라인 스타일 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{
            padding: '0.15rem 0.4rem',
            fontWeight: 700,
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('bold') ? '#e0e7ff' : 'transparent',
            cursor: 'pointer',
          }}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{
            padding: '0.15rem 0.4rem',
            fontStyle: 'italic',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('italic') ? '#e0f2fe' : 'transparent',
            cursor: 'pointer',
          }}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={{
            padding: '0.15rem 0.4rem',
            textDecoration: 'line-through',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('strike') ? '#fee2e2' : 'transparent',
            cursor: 'pointer',
          }}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('highlight').run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('highlight') ? '#fef3c7' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          HL
        </button>
        {/* 리스트 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('bulletList') ? '#dcfce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('orderedList') ? '#fee2e2' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid transparent',
            backgroundColor: editor.isActive('taskList') ? '#e0f2fe' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          ☑ List
        </button>
        {/* 기타 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          style={{
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Redo
        </button>
      </div>

      {/* 에디터 영역 */}
      <div
        style={{
          border: '1px solid #d1d5db',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          padding: '0.5rem',
          minHeight: '160px',
          fontSize: '0.9rem',
          backgroundColor: '#ffffff',
          position: 'relative',
        }}
      >
        {placeholder && !value && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 10,
              pointerEvents: 'none',
              color: '#9ca3af',
              fontSize: '0.85rem',
            }}
          >
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

