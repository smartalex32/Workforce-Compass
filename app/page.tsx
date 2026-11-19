import { runtimeEnv } from '@/db/runtime';
import { OfficeWorkspace } from '@/components/office-workspace';
import { WorkforceExplorer } from '@/components/workforce-explorer';
import { sampleWorkspace } from '@/lib/sample-data';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; organizationId?: string }>;
}) {
  const selection = await searchParams;
  if (
    runtimeEnv.WORKFORCE_COMPASS_LEGACY_ENTRY === 'true' &&
    selection.workspace !== 'offices'
  ) {
    return (
      <WorkforceExplorer
        initialWorkspace={sampleWorkspace}
        organizationId={selection.organizationId}
      />
    );
  }
  return <OfficeWorkspace initialOrganizationId={selection.organizationId} />;
}
