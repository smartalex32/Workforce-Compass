import { WorkforceExplorer } from '@/components/workforce-explorer';
import { sampleWorkspace } from '@/lib/sample-data';

export default function Home() {
  return <WorkforceExplorer initialWorkspace={sampleWorkspace} />;
}
