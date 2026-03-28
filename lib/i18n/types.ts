export type Locale = 'ko' | 'en'

export interface GuideSection {
  title: string
  bullets: string[]
}

export interface TabGuide {
  title: string
  summary: string
  purpose: string
  sections: GuideSection[]
}
