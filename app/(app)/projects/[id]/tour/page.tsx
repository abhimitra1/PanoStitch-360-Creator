import { Suspense } from 'react'
import { TourClient } from './_client'

export function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ id: string }>
}

export default function TourPage({ params }: Props) {
  return (
    <Suspense>
      <TourClient params={params} />
    </Suspense>
  )
}
