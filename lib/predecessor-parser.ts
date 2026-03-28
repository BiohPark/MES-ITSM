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

/** 전각 숫자·제로폭 문자 제거 후 ASCII 숫자로 통일 (입력/붙여넣기 호환) */
function normalizePredecessorToken(part: string): string {
  return part
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\uFF10-\uFF19]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
    )
}

/** 쉼표·세미콜론·전각 쉼표로 항목 분리 (UI placeholder `1FS;3FS` 및 Excel 호환) */
function splitPredecessorParts(input: string): string[] {
  return input
    .trim()
    .split(/[,;，]/)
    .map((part) => normalizePredecessorToken(part.trim()))
    .filter((part) => part.length > 0)
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

  const parts = splitPredecessorParts(input)

  const results: ParsedPredecessor[] = []

  for (const part of parts) {
    try {
      // 형식 1: "2FS+5", "3SS-1" (MS Project 스타일)
      const fullMatch = part.match(/^(\d+)(FS|SS|FF|SF)([+-]?\d*)$/i)
      // 형식 2: "2" (단순 숫자 = FS로 간주)
      const simpleMatch = part.match(/^(\d+)$/)

      const match = fullMatch || simpleMatch
      if (!match) {
        console.warn(`Invalid predecessor format: ${part}`)
        continue
      }

      const index = parseInt(match[1], 10)
      const type = (fullMatch ? fullMatch[2].toUpperCase() : 'FS') as DependencyType
      let lag = 0
      if (fullMatch && fullMatch[3]) {
        const lagStr = fullMatch[3]
        if (lagStr !== '+' && lagStr !== '-') {
          lag = parseInt(lagStr, 10) || 0
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

  const parts = splitPredecessorParts(input)

  for (const part of parts) {
    const match = part.match(/^(\d+)(FS|SS|FF|SF)([+-]?\d*)$/i) || part.match(/^(\d+)$/)
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

/** WBS 행 번호(1-based)·자기 자신·조상 참조 검사용 */
export type PredecessorRefIssue =
  | { type: 'invalid_row'; row: number }
  | { type: 'self' }
  | { type: 'ancestor' }

/**
 * 파싱된 선행 목록이 현재 행·전체 행 수·조상 행 집합과 모순되는지 검사
 * @param selfRow1Based 현재 작업의 행 번호(1-based, # 열과 동일)
 * @param ancestorIndices0 조상 작업의 배열 인덱스(0-based) 목록
 */
export function findPredecessorRefIssue(
  parsed: ParsedPredecessor[],
  selfRow1Based: number,
  taskCount: number,
  ancestorIndices0: number[]
): PredecessorRefIssue | null {
  for (const p of parsed) {
    if (p.index < 1 || p.index > taskCount) {
      return { type: 'invalid_row', row: p.index }
    }
    if (p.index === selfRow1Based) {
      return { type: 'self' }
    }
    if (ancestorIndices0.includes(p.index - 1)) {
      return { type: 'ancestor' }
    }
  }
  return null
}
