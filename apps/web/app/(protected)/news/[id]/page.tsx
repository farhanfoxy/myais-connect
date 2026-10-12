import { NewsDetail } from '@/components/news/news-list';
export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params; return <NewsDetail id={id} />;
}
