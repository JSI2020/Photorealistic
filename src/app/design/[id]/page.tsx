import { DesignClient } from "@/components/studio/design-client";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DesignClient designId={id} />;
}
