import { WorkforceExplorer } from '@/components/workforce-explorer';
import { sampleWorkspace } from '@/lib/sample-data';

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { organizationId } = await searchParams;
  return (
    <WorkforceExplorer
      initialWorkspace={sampleWorkspace}
      organizationId={organizationId}
    />
  );
}
