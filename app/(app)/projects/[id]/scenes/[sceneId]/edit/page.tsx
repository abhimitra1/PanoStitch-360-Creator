import { SceneEditClient } from './_client'

export function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ id: string; sceneId: string }>
}

export default function SceneEditPage({ params }: Props) {
  return <SceneEditClient params={params} />
}
