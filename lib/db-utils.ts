import { getPool } from './db'
import type mysql from 'mysql2/promise'

/**
 * 데이터베이스 쿼리를 안전하게 실행하는 헬퍼 함수
 * 연결 오류 시 자동 재시도 및 명확한 에러 메시지 제공
 */
export async function safeQuery<T = any>(
  query: string,
  params?: any[],
  retries: number = 2
): Promise<T> {
  let lastError: any = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pool = getPool()
      const result = await pool.query<T>(query, params)
      return result[0] as T
    } catch (error: any) {
      lastError = error
      
      // 연결 오류인 경우 재시도
      const isConnectionError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ER_ACCESS_DENIED_ERROR' ||
        error.message?.includes('connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT')
      
      if (isConnectionError && attempt < retries) {
        console.warn(`Database connection error (attempt ${attempt + 1}/${retries + 1}), retrying...`, error.code)
        // 연결 풀 재생성
        const { getPool } = await import('./db')
        // 잠시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        continue
      }
      
      // 재시도 불가능하거나 마지막 시도인 경우
      throw error
    }
  }
  
  throw lastError || new Error('Database query failed after retries')
}

/**
 * 연결을 안전하게 획득하는 헬퍼 함수
 */
export async function safeGetConnection(): Promise<mysql.PoolConnection> {
  let retries = 2
  let lastError: any = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pool = getPool()
      const connection = await pool.getConnection()
      // 연결 테스트
      await connection.ping()
      return connection
    } catch (error: any) {
      lastError = error
      
      const isConnectionError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET'
      
      if (isConnectionError && attempt < retries) {
        console.warn(`Connection acquisition failed (attempt ${attempt + 1}/${retries + 1}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        // 연결 풀 재생성
        const { getPool } = await import('./db')
        continue
      }
      
      throw error
    }
  }
  
  throw lastError || new Error('Failed to acquire database connection')
}

