import { SshInputEditPage } from "@/components/input/ssh/SshInputEditPage";

interface Props { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <SshInputEditPage type="ssh" id={id} />;
}
