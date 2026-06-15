import { SshOutputEditPage } from "@/components/output/ssh/SshOutputEditPage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <SshOutputEditPage id={id} />;
}
