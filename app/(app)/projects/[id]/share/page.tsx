import { ShareClient } from './_client'

export function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ id: string }>
}

export default function SharePage({ params }: Props) {
  return <ShareClient params={params} />
}
