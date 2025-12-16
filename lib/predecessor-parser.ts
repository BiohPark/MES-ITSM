/**
 * MS Project 스타일 종속성 문자열 파싱 유틸리티
 * 예: "2FS+5, 3SS-1" -> [{ index: 2, type: 'FS', lag: 5 }, { index: 3, type: 'SS', lag: -1 }]
 */

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface ParsedPredecessor {
  index: number
  type: DependencyType
  lag: number
}

/**
 * 종속성 문자열 파싱
 * @param input 예: "2FS+5, 3SS-1, 4FF"
 * @returns 파싱된 종속성 배열
 */
export function parsePredecessorString(input: string): ParsedPredecessor[] {
  if (!input || typeof input !== 'string') {
    return []
  }

  // 공백 제거 및 쉼표로 분리
  const parts = input
    .trim()
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)

  const results: ParsedPredecessor[] = []

  for (const part of parts) {
    try {
      // 정규식: 숫자 + 타입(FS/SS/FF/SF) + 선택적 부호 + 선택적 숫자
      const match = part.match(/^(\d+)(FS|SS|FF|SF)([+-]?\d*)$/i)
      
      if (!match) {
        console.warn(`Invalid predecessor format: ${part}`)
        continue
      }

      const index = parseInt(match[1], 10)
      const type = match[2].toUpperCase() as DependencyType
      const lagStr = match[3] || '0'
      
      // Lag 파싱 (+5, -1, +0, -0 등)
      let lag = 0
      if (lagStr) {
        if (lagStr === '+' || lagStr === '-') {
          lag = lagStr === '+' ? 0 : 0
        } else {
          lag = parseInt(lagStr, 10)
        }
      }

      results.push({ index, type, lag })
    } catch (error) {
      console.warn(`Error parsing predecessor part "${part}":`, error)
    }
  }

  return results
}

/**
 * 종속성 문자열 생성 (역변환)
 * @param predecessors 파싱된 종속성 배열
 * @returns MS Project 스타일 문자열
 */
export function formatPredecessorString(predecessors: ParsedPredecessor[]): string {
  return predecessors
    .map(p => {
      const lagStr = p.lag === 0 ? '' : (p.lag > 0 ? `+${p.lag}` : `${p.lag}`)
      return `${p.index}${p.type}${lagStr}`
    })
    .join(', ')
}

/**
 * 종속성 문자열 검증
 * @param input 입력 문자열
 * @returns 유효성 여부
 */
export function validatePredecessorString(input: string): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: true } // 빈 문자열은 유효 (종속성 없음)
  }

  const parts = input
    .trim()
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)

  for (const part of parts) {
    const match = part.match(/^(\d+)(FS|SS|FF|SF)([+-]?\d*)$/i)
    if (!match) {
      return {
        valid: false,
        error: `Invalid format: "${part}". Expected format: "IndexType[±Lag]" (e.g., "2FS+5", "3SS-1")`,
      }
    }

    const index = parseInt(match[1], 10)
    if (index <= 0) {
      return {
        valid: false,
        error: `Invalid index: ${index}. Index must be greater than 0.`,
      }
    }
  }

  return { valid: true }
}


