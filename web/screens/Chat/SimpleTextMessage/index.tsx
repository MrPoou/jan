import React, { useEffect, useRef, useState } from 'react'

import { ChatCompletionRole, MessageStatus, ThreadMessage } from '@janhq/core'

import hljs from 'highlight.js'

import { useAtomValue } from 'jotai'
import { Marked } from 'marked'

import { markedHighlight } from 'marked-highlight'

import { twMerge } from 'tailwind-merge'

import LogoMark from '@/containers/Brand/Logo/Mark'

import BubbleLoader from '@/containers/Loader/Bubble'

import { useClipboard } from '@/hooks/useClipboard'

import { displayDate } from '@/utils/datetime'

import MessageToolbar from '../MessageToolbar'

import { getCurrentChatMessagesAtom } from '@/helpers/atoms/ChatMessage.atom'

const SimpleTextMessage: React.FC<ThreadMessage> = (props) => {
  let text = ''
  if (props.content && props.content.length > 0) {
    text = props.content[0]?.text?.value ?? ''
  }
  const clipboard = useClipboard({ timeout: 1000 })

  const marked = new Marked(
    markedHighlight({
      langPrefix: 'hljs',
      highlight(code, lang) {
        if (lang === undefined || lang === '') {
          return hljs.highlightAuto(code).value
        }
        try {
          return hljs.highlight(code, { language: lang }).value
        } catch (err) {
          return hljs.highlight(code, { language: 'javascript' }).value
        }
      },
    }),
    {
      renderer: {
        code(code, lang, escaped) {
          return `
          <div class="relative code-block group/item">
            <button class='text-xs copy-action hidden group-hover/item:block bg-gray-950 hover:bg-gray-950/90 text-gray-200 p-2 rounded-lg absolute top-6 right-2' >
              ${
                clipboard.copied
                  ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check pointer-events-none text-green-600"><path d="M20 6 9 17l-5-5"/></svg>`
                  : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy pointer-events-none text-gray-400"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
              }
            </button>
            <pre class="hljs">
              <code class="language-${lang ?? ''}">${
                escaped ? code : decodeURIComponent(code)
              }</code>
            </pre>
          </div>
          `
        },
      },
    }
  )

  const parsedText = marked.parse(text)
  const isUser = props.role === ChatCompletionRole.User
  const isSystem = props.role === ChatCompletionRole.System
  const [tokenCount, setTokenCount] = useState(0)

  const [lastTimestamp, setLastTimestamp] = useState<number | undefined>()
  const [tokenSpeed, setTokenSpeed] = useState(0)
  const messages = useAtomValue(getCurrentChatMessagesAtom)

  const codeBlockCopyEvent = useRef((e: Event) => {
    const target: HTMLElement = e.target as HTMLElement
    if (typeof target.className !== 'string') return null
    const isCopyActionClassName = target?.className.includes('copy-action')
    const isCodeBlockParent =
      target.parentElement?.parentElement?.className.includes('code-block')

    if (isCopyActionClassName || isCodeBlockParent) {
      const content = target?.parentNode?.querySelector('code')?.innerText ?? ''
      clipboard.copy(content)
    }
  })

  useEffect(() => {
    document.addEventListener('click', codeBlockCopyEvent.current)
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      document.removeEventListener('click', codeBlockCopyEvent.current)
    }
  }, [])

  useEffect(() => {
    if (
      props.status === MessageStatus.Ready ||
      props.status === MessageStatus.Error
    ) {
      return
    }
    const currentTimestamp = new Date().getTime() // Get current time in milliseconds
    if (!lastTimestamp) {
      // If this is the first update, just set the lastTimestamp and return
      if (props.content[0]?.text?.value !== '')
        setLastTimestamp(currentTimestamp)
      return
    }

    const timeDiffInSeconds = (currentTimestamp - lastTimestamp) / 1000 // Time difference in seconds
    const totalTokenCount = tokenCount + 1
    const averageTokenSpeed = totalTokenCount / timeDiffInSeconds // Calculate average token speed

    setTokenSpeed(averageTokenSpeed)
    setTokenCount(totalTokenCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.content])

  return (
    <div className="group relative mx-auto rounded-xl px-8">
      <div
        className={twMerge(
          'mb-2 flex items-center justify-start gap-x-2',
          !isUser && 'mt-2'
        )}
      >
        {!isUser && !isSystem && <LogoMark width={28} />}
        {isUser && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
            <svg
              width="12"
              height="16"
              viewBox="0 0 12 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 0.497864C4.34315 0.497864 3 1.84101 3 3.49786C3 5.15472 4.34315 6.49786 6 6.49786C7.65685 6.49786 9 5.15472 9 3.49786C9 1.84101 7.65685 0.497864 6 0.497864ZM9.75 7.99786L2.24997 7.99787C1.00734 7.99787 0 9.00527 0 10.2479C0 11.922 0.688456 13.2633 1.81822 14.1701C2.93013 15.0625 4.42039 15.4979 6 15.4979C7.57961 15.4979 9.06987 15.0625 10.1818 14.1701C11.3115 13.2633 12 11.922 12 10.2479C12 9.00522 10.9926 7.99786 9.75 7.99786Z"
                fill="#9CA3AF"
              />
            </svg>
          </div>
        )}
        <div
          className={twMerge(
            'text-sm font-extrabold capitalize',
            isUser && 'text-gray-500'
          )}
        >
          {props.role}
        </div>
        <p className="text-xs font-medium text-gray-400">
          {displayDate(props.created)}
        </p>
        <div
          className={twMerge(
            'absolute right-0 cursor-pointer transition-all',
            messages[messages.length - 1]?.id === props.id && !isUser
              ? 'absolute -bottom-10 right-8'
              : 'hidden group-hover:absolute group-hover:-top-2 group-hover:right-8 group-hover:flex'
          )}
        >
          <MessageToolbar message={props} />
        </div>
        {messages[messages.length - 1]?.id === props.id &&
          (props.status === MessageStatus.Pending || tokenSpeed > 0) && (
            <p className="absolute right-8 text-xs font-medium text-foreground">
              Token Speed: {Number(tokenSpeed).toFixed(2)}/s
            </p>
          )}
      </div>

      <div className={twMerge('w-full')}>
        {props.status === MessageStatus.Pending &&
        (!props.content[0] || props.content[0].text.value === '') ? (
          <BubbleLoader />
        ) : (
          <>
            <div
              className={twMerge(
                'message flex flex-grow flex-col gap-y-2 text-[15px] font-normal leading-relaxed',
                isUser
                  ? 'whitespace-pre-wrap break-words'
                  : 'rounded-xl bg-secondary p-4'
              )}
              // eslint-disable-next-line @typescript-eslint/naming-convention
              dangerouslySetInnerHTML={{ __html: parsedText }}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default React.memo(SimpleTextMessage)
