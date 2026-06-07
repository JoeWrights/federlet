import { useState } from "react";
import {
  MetricTile,
  Modal,
  SharedButton,
  SharedCard,
} from "@federlet/shared-ui";
import { useRemoteAppContext } from "../RemoteAppContext";

export default function OverviewPage() {
  const { portalContainer } = useRemoteAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="react-remote__shared-grid">
      <SharedCard eyebrow="React remote" title="Shared UI card">
        This card is imported from @federlet/shared-ui and resolved through the
        Module Federation shared scope.
      </SharedCard>

      <MetricTile value="1x" label="shared-ui runtime loaded by the Shell" />

      <SharedButton onClick={() => setIsModalOpen(true)}>
        Open shared dashboard
      </SharedButton>

      <Modal
        open={isModalOpen}
        title="Shell-scoped shared modal"
        onClose={() => setIsModalOpen(false)}
        getContainer={() => portalContainer ?? null}
      >
        This modal is rendered by @federlet/shared-ui, but its portal is scoped
        to the Shell remote mount container.
      </Modal>
    </section>
  );
}
