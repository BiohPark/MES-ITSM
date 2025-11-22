import { getPool } from '../lib/db'

async function checkSpecificRecord() {
  const pool = getPool()
  const connection = await pool.getConnection()

  try {
    console.log('📋 "작성 및 리뷰" GMP Record 상세 확인\n')
    
    const [records] = await connection.query<any[]>(
      'SELECT * FROM gmp_records WHERE title LIKE ?',
      ['%작성 및 리뷰%']
    )

    if (records.length === 0) {
      console.log('❌ "작성 및 리뷰"라는 제목의 GMP Record를 찾을 수 없습니다.')
      return
    }

    for (const record of records) {
      console.log(`\n📌 GMP Record: "${record.title}" (ID: ${record.id})`)
      console.log(`  시작일 (DB 원본): ${record.start} (타입: ${typeof record.start})`)
      console.log(`  마감일 (DB 원본): ${record.due} (타입: ${typeof record.due})`)
      console.log(`  실적 진척도: ${record.progress || 0}%`)
      console.log(`  상태: ${record.status}`)
      
      // 날짜 변환
      const start = record.start ? (typeof record.start === 'string' ? record.start : new Date(record.start).toISOString().slice(0, 10)) : null
      const due = record.due ? (typeof record.due === 'string' ? record.due : new Date(record.due).toISOString().slice(0, 10)) : null
      
      console.log(`\n  변환된 시작일: ${start}`)
      console.log(`  변환된 마감일: ${due}`)
      
      // 계획 진척도 계산
      if (!start || !due) {
        console.log(`  ⚠️  시작일 또는 마감일이 없습니다.`)
        continue
      }
      
      const startDate = new Date(start)
      const dueDate = new Date(due)
      const today = new Date()
      
      console.log(`\n  날짜 객체:`)
      console.log(`    시작일: ${startDate.toISOString()}`)
      console.log(`    마감일: ${dueDate.toISOString()}`)
      console.log(`    오늘: ${today.toISOString()}`)
      
      // 날짜를 자정으로 설정
      startDate.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)
      
      const totalDays = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      console.log(`\n  계산:`)
      console.log(`    전체 일수: ${totalDays}`)
      console.log(`    경과 일수: ${elapsedDays}`)
      
      let plannedProgress = 0
      if (totalDays <= 0) {
        if (elapsedDays >= 0) {
          plannedProgress = 100
          console.log(`    ✅ 시작일=마감일이고 오늘이 해당 날짜 이후이므로 100%`)
        } else {
          plannedProgress = 0
          console.log(`    ⚠️  시작일=마감일이고 오늘이 해당 날짜 이전이므로 0%`)
        }
      } else if (elapsedDays < 0) {
        plannedProgress = 0
        console.log(`    ⚠️  경과 일수가 음수 (시작일이 미래)이므로 0%`)
      } else if (elapsedDays > totalDays) {
        plannedProgress = 100
        console.log(`    ⚠️  경과 일수가 전체 일수보다 큼이므로 100%`)
      } else {
        plannedProgress = Math.round((elapsedDays / totalDays) * 100)
        console.log(`    ✅ 계산된 진척도: ${plannedProgress}%`)
      }
      
      console.log(`\n  📊 최종 계획 진척도: ${plannedProgress}%`)
    }

  } catch (error) {
    console.error('❌ 확인 실패:', error)
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  try {
    await checkSpecificRecord()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()

