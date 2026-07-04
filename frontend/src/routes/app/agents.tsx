import { createFileRoute } from "@tanstack/react-router";

import { AgentsBand } from "@/components/control-room/agents-band";
import { TourAnchor, TOUR_STEPS } from "@/components/control-room/demo-tour";
import { useControlRoom } from "@/components/control-room/control-room-context";

export const Route = createFileRoute("/app/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const { data, executions, setOpenDraft, tourStep } = useControlRoom();
  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rules identify the risk · AI drafts the action · you approve.
        </p>
      </div>

      <TourAnchor id="agents" active={activeAnchor === "agents"}>
        <AgentsBand
          drafts={data.drafts}
          executions={executions}
          mode={data.snapshot.mode}
          onOpen={setOpenDraft}
        />
      </TourAnchor>
    </div>
  );
}
