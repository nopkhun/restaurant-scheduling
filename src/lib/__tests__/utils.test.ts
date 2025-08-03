import { cn } from '../utils'

describe('Utils', () => {
  describe('cn function', () => {
    test('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'bg-red')).toBe('px-2 py-1 bg-red')
    })

    test('should handle conditional classes', () => {
      expect(cn('base-class', true && 'conditional-class')).toBe('base-class conditional-class')
      expect(cn('base-class', false && 'conditional-class')).toBe('base-class')
    })

    test('should handle conflicting Tailwind classes', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    })

    test('should handle empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined)).toBe('')
    })

    test('should handle arrays and objects', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2')
      expect(cn({ 'class1': true, 'class2': false })).toBe('class1')
    })
  })
})