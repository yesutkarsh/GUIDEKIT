import type { CSSProperties } from 'react'
import type { ProjectBackgroundId } from './types'

export interface ProjectBackgroundDefinition {
  id: ProjectBackgroundId
  name: string
  type: 'line' | 'prism' | 'columns' | 'sky' | 'retro'
  stops: readonly string[]
  speed: number
  posterStyle: CSSProperties
}

export const PROJECT_BACKGROUNDS: readonly ProjectBackgroundDefinition[] = [
  {
    id: 'untitled-blend',
    name: 'Untitled Blend',
    type: 'line',
    stops: ['#F5F6F8', '#A9C9F0', '#4E86D6', '#1B4FA0', '#0B2B57'],
    speed: 0,
    posterStyle: { background: 'linear-gradient(135deg, #F5F6F8 0%, #A9C9F0 24%, #4E86D6 50%, #1B4FA0 75%, #0B2B57 100%)' },
  },
  {
    id: 'citron',
    name: 'Citron',
    type: 'prism',
    stops: ['#26483D', '#557D57', '#A4B963', '#D6D998', '#F2EDCC'],
    speed: 40,
    posterStyle: { background: 'linear-gradient(125deg, #26483D 0%, #557D57 26%, #A4B963 50%, #D6D998 74%, #F2EDCC 100%)' },
  },
  {
    id: 'morning-haze',
    name: 'Morning Haze',
    type: 'columns',
    stops: ['#FBF3E7', '#F4B3C2', '#B28FCE', '#5654A2'],
    speed: 34,
    posterStyle: { background: 'linear-gradient(100deg, #FBF3E7 0%, #F4B3C2 34%, #B28FCE 67%, #5654A2 100%)' },
  },
  {
    id: 'blue-sky',
    name: 'Blue Sky',
    type: 'sky',
    stops: ['#E6F2FF', '#B3D9FF', '#80B3FF', '#6699E6'],
    speed: 22,
    posterStyle: { background: 'linear-gradient(180deg, #E6F2FF 0%, #B3D9FF 35%, #80B3FF 68%, #6699E6 100%)' },
  },
  {
    id: 'sunset-pop',
    name: 'Sunset Pop',
    type: 'retro',
    stops: ['#FFF1CF', '#F09199', '#EE7800', '#824880'],
    speed: 22,
    posterStyle: { background: 'linear-gradient(135deg, #FFF1CF 0%, #F09199 34%, #EE7800 66%, #824880 100%)' },
  },
] as const

const backgroundMap = new Map(PROJECT_BACKGROUNDS.map((background) => [background.id, background]))

export function getProjectBackground(id: string | null | undefined): ProjectBackgroundDefinition {
  return backgroundMap.get(id as ProjectBackgroundId) ?? PROJECT_BACKGROUNDS[0]
}

export function randomProjectBackgroundId(): ProjectBackgroundId {
  return PROJECT_BACKGROUNDS[Math.floor(Math.random() * PROJECT_BACKGROUNDS.length)].id
}
