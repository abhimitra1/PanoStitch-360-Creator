import { Suspense } from 'react'
import { Import360Client } from './_client'

interface Props {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return []
}

export default function Import360Page({ params }: Props) {
  return (
    <Suspense>
      <Import360Client params={params} />
    </Suspense>
  )
}
