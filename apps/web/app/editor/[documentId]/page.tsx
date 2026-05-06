import EditorLayout from './components/editorLayout'

type EditorPageProps = {
  params: Promise<{ documentId: string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { documentId } = await params
  return <EditorLayout documentId={documentId} />
}