export type CommentEntityType = 'project' | 'task' | 'gmp_record'

export interface Comment {
  id: string
  entity_type: CommentEntityType
  entity_id: string
  author: string
  content: string
  created_at: string
  updated_at: string
}

