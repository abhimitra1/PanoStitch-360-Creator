import { ProjectDashboardClient } from './_client'

export function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ id: string }>
}

export default function ProjectPage({ params }: Props) {
  return <ProjectDashboardClient params={params} />
}
