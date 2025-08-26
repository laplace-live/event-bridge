'use client'

import { AnimatePresence, type MotionProps, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type CharacterSet = string[] | readonly string[]

interface HyperTextProps extends MotionProps {
  children: string
  className?: string
  duration?: number
  as?: React.ElementType
  characterSet?: CharacterSet
}

const DEFAULT_CHARACTER_SET = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) as readonly string[]

const getRandomInt = (max: number): number => Math.floor(Math.random() * max)

export function TextEffect({
  children,
  className,
  duration = 800,
  as: Component = 'div',
  characterSet = DEFAULT_CHARACTER_SET,
  ...props
}: HyperTextProps) {
  const MotionComponent = motion.create(Component, {
    forwardMotionProps: true,
  })

  const [displayText, setDisplayText] = useState<string[]>(() => children.split(''))
  const [isAnimating, setIsAnimating] = useState(false)
  const iterationCount = useRef(0)

  // Start animation on mount
  useEffect(() => {
    setIsAnimating(true)
  }, [])

  // Handle scramble animation
  useEffect(() => {
    if (!isAnimating) return

    const maxIterations = children.length
    const startTime = performance.now()
    let animationFrameId: number

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      iterationCount.current = progress * maxIterations

      setDisplayText(currentText =>
        currentText.map((letter, index) =>
          letter === ' '
            ? letter
            : index <= iterationCount.current
              ? (children[index] ?? letter)
              : (characterSet[getRandomInt(characterSet.length)] ?? letter)
        )
      )

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  }, [children, duration, isAnimating, characterSet])

  return (
    <MotionComponent className={cn('overflow-hidden', className)} {...props}>
      <AnimatePresence>
        {displayText.map((letter, index) => (
          <motion.span key={`${index}-${letter}`} className={'font-mono'}>
            {letter.toUpperCase()}
          </motion.span>
        ))}
      </AnimatePresence>
    </MotionComponent>
  )
}
