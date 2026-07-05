import { createFileRoute } from "@tanstack/react-router";

import { OverviewFrancesco } from "@/components/control-room/overview-francesco";
import { TOUR_STEPS } from "@/components/control-room/demo-tour";
import { useControlRoom } from "@/components/control-room/control-room-context";

export const Route = createFileRoute("/app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { data, executedTotal, executions, projectedShortfall, setOpenDraft, tourStep } =
    useControlRoom();
  const activeAnchor = tourStep !== null ? TOUR_STEPS[tourStep].anchor : null;

  return (
    <OverviewFrancesco
      activeAnchor={activeAnchor}
      data={data}
      executedTotal={executedTotal}
      projectedShortfall={projectedShortfall}
      executions={executions}
      onOpenDraft={setOpenDraft}
    />
  );
}
