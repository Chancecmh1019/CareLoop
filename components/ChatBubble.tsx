import { cn } from '@/lib/utils'

export function ChatBubble({
  role,
  content,
  time,
}: {
  role: 'user' | 'assistant'
  content: string
  time: string
}) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2D5F5D] text-xs font-black text-white">
          CL
        </div>
      )}
      <div
        className={cn(
          'max-w-[84%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm',
          isUser
            ? 'bg-[#2D5F5D] text-white'
            : 'border border-[#D5C9BB] bg-[#FFFDF9] text-[#1F2937]',
        )}
      >
        {content.split('\n').map((line, index, lines) => (
          <span key={`${line}-${index}`}>
            {line}
            {index < lines.length - 1 && <br />}
          </span>
        ))}
        <div className={cn('mt-2 text-[11px]', isUser ? 'text-white/70' : 'text-[#6B7280]')}>
          {time}
        </div>
      </div>
    </div>
  )
}
